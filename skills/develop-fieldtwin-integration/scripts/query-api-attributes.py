#!/usr/bin/env python3
"""Query the generated FieldTwin API attribute catalogs without loading them wholesale."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any


REFERENCES = Path(__file__).resolve().parents[1] / "references"


def parse_arguments() -> argparse.Namespace:
    """Parse lookup filters."""

    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--version", required=True, choices=("v1.10", "v2.0"))
    parser.add_argument("--method", choices=("get", "post", "patch", "delete", "put"))
    parser.add_argument("--stream", help="v2 stream: users, accounts, projects, subProjects, or workflowTasks")
    parser.add_argument("--resource", help="v2 resource type, or v1.10 group/path search term")
    parser.add_argument("--path", help="v1.10 endpoint path substring")
    parser.add_argument("--group", help="v1.10 ApiDoc group substring")
    parser.add_argument("--field", help="Attribute path substring")
    parser.add_argument(
        "--location",
        choices=("header", "path", "query", "body", "response"),
        help="v1.10 attribute location",
    )
    parser.add_argument("--list-resources", action="store_true")
    parser.add_argument("--list-operations", action="store_true")
    parser.add_argument("--json", action="store_true", help="Emit filtered JSON instead of tables")
    return parser.parse_args()


def load_catalog(version: str) -> dict[str, Any]:
    """Load one generated catalog."""

    path = REFERENCES / f"api-attributes-{version}.json"
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError:
        raise SystemExit(f"Missing generated catalog: {path}") from None


def contains(value: Any, search: str | None) -> bool:
    """Match a case-insensitive substring when a search term is present."""

    if not search:
        return True
    return search.casefold() in str(value or "").casefold()


def filter_attributes(
    attributes: list[dict[str, Any]], field: str | None, location: str | None = None
) -> list[dict[str, Any]]:
    """Filter attributes by path and optional v1.10 location."""

    return [
        attribute
        for attribute in attributes
        if contains(attribute.get("path"), field)
        and (not location or attribute.get("location") == location)
    ]


def markdown_cell(value: Any) -> str:
    """Render a compact Markdown table cell."""

    if value is None:
        return ""
    if isinstance(value, (list, dict)):
        value = json.dumps(value, separators=(",", ":"), ensure_ascii=False)
    return str(value).replace("|", "\\|").replace("\n", " ")


def print_table(headers: list[str], rows: list[list[Any]]) -> None:
    """Print one Markdown table."""

    print("| " + " | ".join(headers) + " |")
    print("| " + " | ".join("---" for _ in headers) + " |")
    for row in rows:
        print("| " + " | ".join(markdown_cell(value) for value in row) + " |")


def query_v110(catalog: dict[str, Any], arguments: argparse.Namespace) -> None:
    """Query the effective v1.10 operation catalog."""

    operations = []
    for operation in catalog["operations"]:
        if arguments.method and operation["method"] != arguments.method.upper():
            continue
        if not contains(operation["path"], arguments.path):
            continue
        if not contains(operation.get("group"), arguments.group):
            continue
        if arguments.resource and not (
            contains(operation.get("group"), arguments.resource)
            or contains(operation["path"], arguments.resource)
        ):
            continue
        attributes = filter_attributes(
            operation["attributes"], arguments.field, arguments.location
        )
        if (arguments.field or arguments.location) and not attributes:
            continue
        operations.append({**operation, "attributes": attributes})

    if arguments.list_operations:
        rows = [
            [
                operation["method"],
                operation["path"],
                operation.get("group"),
                len(operation["attributes"]),
                operation["sourceVersion"],
            ]
            for operation in operations
        ]
        print_table(["Method", "Path", "Group", "Attributes", "Source"], rows)
        return

    has_selector = any(
        (
            arguments.method,
            arguments.path,
            arguments.group,
            arguments.resource,
            arguments.field,
            arguments.location,
        )
    )
    if not has_selector:
        print(
            f"v1.10: {len(catalog['operations'])} effective operations. "
            "Add --list-operations or an endpoint/group/resource filter."
        )
        return

    if arguments.json:
        print(json.dumps(operations, indent=2, ensure_ascii=False))
        return

    for operation in operations:
        inherited = " (inherited from v1.9)" if operation.get("inherited") else ""
        print(f"\n### {operation['method']} {operation['path']}{inherited}\n")
        print_table(
            ["Location", "Attribute", "Type", "Optional", "Description"],
            [
                [
                    attribute["location"],
                    attribute["path"],
                    attribute["type"],
                    "yes" if attribute.get("optional") else "no",
                    attribute.get("description"),
                ]
                for attribute in operation["attributes"]
            ],
        )
    if not operations:
        raise SystemExit("No v1.10 operation or attribute matched the supplied filters.")


def combined_v2_get_attributes(
    catalog: dict[str, Any], resource_type: str, stream_name: str | None
) -> list[dict[str, Any]]:
    """Apply stream-specific v2 GET additions and exclusions to a manifest resource."""

    resource = catalog["resources"].get(resource_type)
    if not resource:
        return []
    attributes = [dict(attribute, source="manifest") for attribute in resource["attributes"]]
    if not stream_name:
        return attributes

    stream = catalog["streams"].get(stream_name)
    if not stream:
        raise SystemExit(f"Unknown v2 stream: {stream_name}")
    get_configuration = stream.get("get", {})
    override = get_configuration.get("resourceOverrides", {}).get(resource_type, {})
    excluded = set(override.get("excludedAttributes", []))
    attributes = [attribute for attribute in attributes if attribute["path"] not in excluded]
    attributes.extend(
        dict(attribute, source="stream addition")
        for attribute in override.get("additionalAttributes", [])
    )
    if resource_type == stream_name:
        attributes.extend(
            dict(attribute, source="root stream addition")
            for attribute in get_configuration.get("rootAdditionalAttributes", [])
        )
    relation = get_configuration.get("additionalRelationships", {}).get(resource_type)
    if relation:
        attributes.extend(
            dict(attribute, source="calculated relationship")
            for attribute in relation["attributes"]
        )
    return sorted(attributes, key=lambda attribute: attribute["path"])


def list_v2_resources(catalog: dict[str, Any]) -> None:
    """List read resources and write availability by stream."""

    rows = []
    for resource_type, resource in sorted(catalog["resources"].items()):
        write_locations = []
        for stream_name, stream in catalog["streams"].items():
            methods = [
                method
                for method in ("post", "patch", "delete")
                if resource_type in stream[method]
            ]
            if methods:
                write_locations.append(f"{stream_name}:{','.join(methods)}")
        rows.append(
            [resource_type, len(resource["attributes"]), "; ".join(write_locations)]
        )
    print_table(["Resource", "Read attributes", "Write contexts"], rows)


def query_v2_operations(catalog: dict[str, Any], arguments: argparse.Namespace) -> None:
    """Query complete v2 OpenAPI operations, including specialized endpoints and envelopes."""

    operations = []
    for operation in catalog["operations"]:
        if arguments.method and operation["method"] != arguments.method.upper():
            continue
        if not contains(operation["path"], arguments.path):
            continue
        if arguments.resource and not contains(operation["path"], arguments.resource):
            continue
        attributes = filter_attributes(
            operation["attributes"], arguments.field, arguments.location
        )
        if (arguments.field or arguments.location) and not attributes:
            continue
        operations.append({**operation, "attributes": attributes})

    if arguments.list_operations:
        print_table(
            ["Method", "Path", "Attributes", "Summary"],
            [
                [
                    operation["method"],
                    operation["path"],
                    len(operation["attributes"]),
                    operation.get("summary"),
                ]
                for operation in operations
            ],
        )
        return
    if arguments.json:
        print(json.dumps(operations, indent=2, ensure_ascii=False))
        return
    for operation in operations:
        print(f"\n### {operation['method']} {operation['path']}\n")
        print_table(
            [
                "Location",
                "Attribute",
                "Type",
                "Required",
                "Media type",
                "Allowed values",
                "Description",
            ],
            [
                [
                    attribute["location"],
                    attribute["path"],
                    attribute["type"],
                    "yes" if attribute.get("required") else "no",
                    attribute.get("mediaType"),
                    attribute.get("allowedValues"),
                    attribute.get("description"),
                ]
                for attribute in operation["attributes"]
            ],
        )
    if not operations:
        raise SystemExit("No v2 operation or attribute matched the supplied filters.")


def query_v2(catalog: dict[str, Any], arguments: argparse.Namespace) -> None:
    """Query v2 manifest and per-stream write schemas."""

    if arguments.list_resources:
        list_v2_resources(catalog)
        return
    if arguments.list_operations or arguments.path:
        query_v2_operations(catalog, arguments)
        return
    if not arguments.resource:
        print(
            f"v2.0: {len(catalog['resources'])} readable resource types across "
            f"{len(catalog['streams'])} streams. Add --list-resources or --resource."
        )
        return

    method = arguments.method or "get"
    matches = []
    if method == "get":
        attributes = combined_v2_get_attributes(catalog, arguments.resource, arguments.stream)
        attributes = filter_attributes(attributes, arguments.field)
        if attributes:
            matches.append(
                {
                    "method": "get",
                    "stream": arguments.stream,
                    "resource": arguments.resource,
                    "attributes": attributes,
                }
            )
    else:
        streams = (
            {arguments.stream: catalog["streams"].get(arguments.stream)}
            if arguments.stream
            else catalog["streams"]
        )
        for stream_name, stream in streams.items():
            if not stream:
                raise SystemExit(f"Unknown v2 stream: {stream_name}")
            resource = stream[method].get(arguments.resource)
            if not resource:
                continue
            attributes = filter_attributes(resource["attributes"], arguments.field)
            if attributes or not arguments.field:
                matches.append(
                    {
                        "method": method,
                        "stream": stream_name,
                        "resource": arguments.resource,
                        "attributes": attributes,
                    }
                )

    if not matches:
        raise SystemExit("No v2 resource schema or attribute matched the supplied filters.")
    if arguments.json:
        print(json.dumps(matches, indent=2, ensure_ascii=False))
        return

    for match in matches:
        stream_label = match["stream"] or "all streams (base manifest)"
        print(
            f"\n### {match['method'].upper()} {match['resource']} — {stream_label}\n"
        )
        if method == "get":
            print_table(
                ["Attribute", "Type", "Read only", "Source", "Description"],
                [
                    [
                        attribute["path"],
                        attribute["type"],
                        "yes" if attribute.get("readOnly") else "no",
                        attribute.get("source"),
                        attribute.get("description"),
                    ]
                    for attribute in match["attributes"]
                ],
            )
        else:
            print_table(
                ["Attribute", "Type", "Required", "Allowed values", "Description"],
                [
                    [
                        attribute["path"],
                        attribute["type"],
                        "yes" if attribute.get("required") else "no",
                        attribute.get("allowedValues"),
                        attribute.get("description"),
                    ]
                    for attribute in match["attributes"]
                ],
            )


def main() -> None:
    """Run the selected catalog query."""

    arguments = parse_arguments()
    catalog = load_catalog(arguments.version)
    if arguments.version == "v1.10":
        query_v110(catalog, arguments)
    else:
        query_v2(catalog, arguments)


if __name__ == "__main__":
    try:
        main()
    except BrokenPipeError:
        sys.exit(0)
