#!/usr/bin/env python3
"""Query FieldTwin host-client postMessage events and fields without loading the full catalog."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any


CATALOG_PATH = (
    Path(__file__).resolve().parents[1]
    / "references"
    / "postmessage-attributes.json"
)


def parse_arguments() -> argparse.Namespace:
    """Parse event and field filters."""

    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--direction",
        choices=("host-to-integration", "integration-to-host"),
    )
    parser.add_argument("--event", help="Exact or partial event name")
    parser.add_argument("--variant", help="Variant name substring")
    parser.add_argument("--category", help="Category substring")
    parser.add_argument("--surface", help="Surface such as designer, pop-out, modal, or project-settings")
    parser.add_argument(
        "--delivery",
        choices=("sendMessage", "bootstrapDirect", "directReply", "integrationSend"),
    )
    parser.add_argument("--field", help="Nested field path substring")
    parser.add_argument("--list-events", action="store_true")
    parser.add_argument("--json", action="store_true", help="Emit filtered JSON")
    return parser.parse_args()


def contains(value: Any, search: str | None) -> bool:
    """Apply a case-insensitive substring filter."""

    if not search:
        return True
    return search.casefold() in str(value or "").casefold()


def markdown_cell(value: Any) -> str:
    """Render one compact Markdown table cell."""

    if value is None:
        return ""
    if isinstance(value, (list, dict)):
        value = json.dumps(value, separators=(",", ":"), ensure_ascii=False)
    return str(value).replace("|", "\\|").replace("\n", " ")


def print_table(headers: list[str], rows: list[list[Any]]) -> None:
    """Print a Markdown table."""

    print("| " + " | ".join(headers) + " |")
    print("| " + " | ".join("---" for _ in headers) + " |")
    for row in rows:
        print("| " + " | ".join(markdown_cell(value) for value in row) + " |")


def load_catalog() -> dict[str, Any]:
    """Load the generated protocol catalog."""

    try:
        return json.loads(CATALOG_PATH.read_text(encoding="utf-8"))
    except FileNotFoundError:
        raise SystemExit(f"Missing generated catalog: {CATALOG_PATH}") from None


def matching_messages(
    catalog: dict[str, Any], arguments: argparse.Namespace
) -> list[dict[str, Any]]:
    """Return messages and only the matching fields."""

    results = []
    for item in catalog["messages"]:
        if arguments.direction and item["direction"] != arguments.direction:
            continue
        if not contains(item["event"], arguments.event):
            continue
        if not contains(item["variant"], arguments.variant):
            continue
        if not contains(item["category"], arguments.category):
            continue
        if arguments.surface and not any(
            contains(surface, arguments.surface) for surface in item["surfaces"]
        ):
            continue
        if arguments.delivery and item["delivery"] != arguments.delivery:
            continue

        fields = [
            field
            for field in item["fields"]
            if contains(field["path"], arguments.field)
        ]
        if arguments.field and not fields:
            continue
        results.append({**item, "fields": fields})
    return results


def list_events(messages: list[dict[str, Any]]) -> None:
    """List matching message variants."""

    print_table(
        ["Direction", "Event", "Variant", "Category", "Delivery", "Fields", "Reply"],
        [
            [
                item["direction"],
                item["event"],
                item["variant"],
                item["category"],
                item["delivery"],
                len(item["fields"]),
                item.get("reply", {}).get("event") if item.get("reply") else "",
            ]
            for item in messages
        ],
    )


def print_messages(messages: list[dict[str, Any]]) -> None:
    """Print field tables with routing and correlation metadata."""

    for item in messages:
        print(
            f"\n### {item['direction']} · {item['event']} · {item['variant']}\n"
        )
        print(item["summary"])
        print(
            f"\nDelivery: `{item['delivery']}` · Surfaces: "
            + ", ".join(f"`{surface}`" for surface in item["surfaces"])
            + f" · Correlation: {item['correlation']}"
        )
        if item.get("reply"):
            reply = item["reply"]
            event_name = reply.get("event") or "binary/no event"
            print(f"\nReply: `{event_name}` ({reply.get('kind', 'unspecified')})")
        for note in item.get("notes", []):
            print(f"\n- {note}")
        print()
        print_table(
            [
                "Field",
                "Type",
                "Required",
                "Allowed/constant",
                "Source",
                "Sensitive",
                "Description",
            ],
            [
                [
                    field["path"],
                    field["type"],
                    "yes" if field["required"] else "no",
                    field.get("allowedValues", field.get("constant")),
                    field.get("suppliedBy"),
                    "yes" if field.get("sensitive") else "no",
                    field["description"],
                ]
                for field in item["fields"]
            ],
        )


def main() -> None:
    """Run the requested catalog query."""

    arguments = parse_arguments()
    catalog = load_catalog()
    messages = matching_messages(catalog, arguments)

    has_selector = any(
        (
            arguments.direction,
            arguments.event,
            arguments.variant,
            arguments.category,
            arguments.surface,
            arguments.delivery,
            arguments.field,
        )
    )
    if not has_selector and not arguments.list_events:
        counts = catalog["counts"]
        print(
            f"postMessage: {counts['messages']} message variants, "
            f"{counts['distinctHostToIntegrationEvents']} host-to-integration events, "
            f"{counts['distinctIntegrationToHostEvents']} integration-to-host events, "
            f"{counts['fields']} effective fields. Add --list-events or a filter."
        )
        return

    if not messages:
        raise SystemExit("No postMessage event or field matched the supplied filters.")
    if arguments.json:
        print(json.dumps(messages, indent=2, ensure_ascii=False))
        return
    if arguments.list_events:
        list_events(messages)
        return
    print_messages(messages)


if __name__ == "__main__":
    main()
