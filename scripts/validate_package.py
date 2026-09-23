#!/usr/bin/env python3
"""Validate the public FieldTwin Agent Skills package with the standard library."""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path
from typing import Optional
from urllib.parse import unquote, urlsplit


REPOSITORY_ROOT = Path(__file__).resolve().parents[1]
SKILLS_ROOT = REPOSITORY_ROOT / "skills"
CHANGELOG_PATH = REPOSITORY_ROOT / "CHANGELOG.md"
LICENSE_PATH = REPOSITORY_ROOT / "LICENSE"
NAME_PATTERN = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
VERSION_PATTERN = re.compile(
    r"^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)"
    r"(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?"
    r"(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$"
)
FRONTMATTER_FIELDS = {
    "name",
    "description",
    "license",
    "compatibility",
    "metadata",
    "allowed-tools",
}
DEVELOP_INTEGRATION_REFERENCES = {
    "api-attributes.md",
    "backend-api-batch.md",
    "backend-api-v1.10.md",
    "backend-api-v2.0.md",
    "backend-api.md",
    "bridge-and-api.md",
    "development-workflow.md",
    "documentation-map.md",
    "integration-to-host-events.md",
    "manifest-and-loading.md",
    "message-catalog.md",
    "operation-mode.md",
    "postmessage-attributes.md",
    "recipes.md",
    "security-and-testing.md",
    "system-highlighting.md",
}
DEVELOP_INTEGRATION_FILES = {
    "references/api-attributes-v1.10.json",
    "references/api-attributes-v2.0.json",
    "references/postmessage-attributes.json",
    "scripts/generate-api-attributes.mjs",
    "scripts/generate-postmessage-catalog.mjs",
    "scripts/query-api-attributes.py",
    "scripts/query-postmessage-attributes.py",
    "scripts/schema-loader.mjs",
}
CREATE_INTEGRATION_REFERENCES = {"repository-and-deployment.md"}
REQUIRED_REPOSITORY_FILES = {
    ".github/workflows/validate.yml",
    "CHANGELOG.md",
    "CONTRIBUTING.md",
    "LICENSE",
    "README.md",
    "SECURITY.md",
}
FORBIDDEN_PLATFORM_PATHS = {
    ".agents/plugins/marketplace.json",
    ".codex-plugin/plugin.json",
    "agents/openai.yaml",
}
SCANNED_SUFFIXES = {
    "",
    ".cjs",
    ".js",
    ".json",
    ".md",
    ".mjs",
    ".py",
    ".toml",
    ".txt",
    ".yaml",
    ".yml",
}
MARKDOWN_LINK_PATTERN = re.compile(
    r"!?\[[^\]]*\]\(\s*(?:<([^>]+)>|([^\s)]+))(?:\s+['\"][^)]*['\"])?\s*\)"
)
MARKDOWN_FENCE_PATTERN = re.compile(r"(?:^|\n)```[^\n]*\n(.*?)\n```", re.DOTALL)
UNSAFE_POSTMESSAGE_PATTERN = re.compile(
    r"\bpostMessage\s*\((?:(?![;\n]{2}).){0,800},\s*['\"]\*['\"]\s*\)",
    re.DOTALL,
)
UNSAFE_TARGET_ORIGIN_PATTERN = re.compile(r"\btargetOrigin\s*[:=]\s*['\"]\*['\"]")
PRIVATE_MARKERS = (
    "field-" + "activity-planner",
    "Integration" + "Tab.svelte",
    "handle" + "TabMessage.js",
    "integration" + "Events.js",
    "common/" + "libraries/",
    "common/" + "tests/",
    "frontends/" + "designer/",
    "api-qa." + "fieldtwin.com",
    "XvisionAS/" + "FieldTwin-Integration-Demo",
    "fieldtwin-" + "codex-plugins",
    "/pri" + "vate/",
    "/var/" + "folders/",
    ".corp" + ".",
    ".internal" + ".",
)
PRIVATE_CASE_SENSITIVE_MARKERS = (
    "/Us" + "ers/",
    "C:\\" + "Users\\",
)
SECRET_PATTERNS = (
    ("private key", re.compile(r"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----")),
    ("AWS access key", re.compile(r"\bAKIA[0-9A-Z]{16}\b")),
    ("GitHub token", re.compile(r"\bgh[pousr]_[A-Za-z0-9]{30,}\b")),
    ("GitLab token", re.compile(r"\bglpat-[A-Za-z0-9_-]{20,}\b")),
    ("npm token", re.compile(r"\bnpm_[A-Za-z0-9]{30,}\b")),
    ("Google API key", re.compile(r"\bAIza[0-9A-Za-z_-]{35}\b")),
    (
        "service API key",
        re.compile(r"\b(?:sk-(?:proj-)?|sk_live_)[A-Za-z0-9_-]{20,}\b"),
    ),
    ("Slack token", re.compile(r"\bxox[baprs]-[A-Za-z0-9-]{20,}\b")),
    (
        "JWT",
        re.compile(r"\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b"),
    ),
    (
        "literal secret assignment",
        re.compile(
            r"(?i)\b(?:api[_-]?key|client[_-]?secret|password)\s*[:=]\s*"
            r"['\"][^'\"\s<>{}$]{8,}['\"]"
        ),
    ),
    (
        "literal bearer credential",
        re.compile(r"(?i)\bBearer\s+(?!<|\$\{|process\.env)[A-Za-z0-9._~-]{20,}"),
    ),
    (
        "literal token assignment",
        re.compile(
            r"(?i)\b(?:access[_-]?token|auth[_-]?token|token)\s*[:=]\s*['\"]"
            r"(?!(?:example|placeholder|fake|test|sample|replace|your))"
            r"[A-Za-z0-9._~-]{24,}['\"]"
        ),
    ),
)


class Validation:
    """Collect failures so one run reports every actionable issue."""

    def __init__(self) -> None:
        self.errors: list[str] = []

    def require(self, condition: bool, message: str) -> None:
        """Record a failure when a required condition is false."""

        if not condition:
            self.errors.append(message)


def relative(path: Path) -> str:
    """Return a stable repository-relative path for diagnostics."""

    try:
        return path.resolve().relative_to(REPOSITORY_ROOT.resolve()).as_posix()
    except ValueError:
        return str(path)


def unquote_scalar(value: str) -> str:
    """Unquote the simple YAML scalars used by this package."""

    stripped = value.strip()
    if len(stripped) >= 2 and stripped[0] == stripped[-1] and stripped[0] in "'\"":
        return stripped[1:-1]
    return stripped


def parse_frontmatter(
    path: Path, validation: Validation
) -> Optional[tuple[dict[str, str], dict[str, str], int]]:
    """Parse the portable scalar frontmatter used by one Agent Skill."""

    try:
        lines = path.read_text(encoding="utf-8").splitlines()
    except FileNotFoundError:
        validation.errors.append(f"Missing skill file: {relative(path)}")
        return None

    validation.require(bool(lines) and lines[0].strip() == "---", f"{relative(path)} must start with YAML frontmatter")
    if not lines or lines[0].strip() != "---":
        return None

    try:
        closing_index = next(
            index for index, line in enumerate(lines[1:], start=1) if line.strip() == "---"
        )
    except StopIteration:
        validation.errors.append(f"{relative(path)} has no closing YAML frontmatter delimiter")
        return None

    fields: dict[str, str] = {}
    metadata: dict[str, str] = {}
    current_mapping = ""
    for line_number, line in enumerate(lines[1:closing_index], start=2):
        if not line.strip() or line.lstrip().startswith("#"):
            continue

        nested_match = re.fullmatch(r"\s+([A-Za-z][A-Za-z0-9_-]*):\s*(.+?)\s*", line)
        if nested_match:
            if current_mapping != "metadata":
                validation.errors.append(
                    f"Unsupported nested frontmatter at {relative(path)}:{line_number}"
                )
                continue
            key = nested_match.group(1)
            validation.require(key not in metadata, f"Duplicate metadata key {key!r} in {relative(path)}")
            metadata[key] = unquote_scalar(nested_match.group(2))
            continue

        match = re.fullmatch(r"([A-Za-z][A-Za-z0-9_-]*):\s*(.*?)\s*", line)
        if not match:
            validation.errors.append(f"Unsupported frontmatter syntax at {relative(path)}:{line_number}")
            continue

        key = match.group(1)
        raw_value = match.group(2)
        current_mapping = key if not raw_value else ""
        validation.require(key not in fields, f"Duplicate frontmatter field {key!r} in {relative(path)}")
        fields[key] = unquote_scalar(raw_value)

    return fields, metadata, len(lines)


def validate_skill(skill_path: Path, validation: Validation) -> None:
    """Validate one canonical skill against the portable Agent Skills contract."""

    parsed = parse_frontmatter(skill_path, validation)
    if parsed is None:
        return

    fields, metadata, line_count = parsed
    unknown_fields = set(fields) - FRONTMATTER_FIELDS
    validation.require(not unknown_fields, f"Non-portable frontmatter fields in {relative(skill_path)}: {sorted(unknown_fields)}")

    name = fields.get("name", "")
    description = fields.get("description", "")
    validation.require(1 <= len(name) <= 64, f"Skill name must contain 1-64 characters: {name!r}")
    validation.require(bool(NAME_PATTERN.fullmatch(name)), f"Invalid skill name: {name!r}")
    validation.require(name == skill_path.parent.name, f"Skill name {name!r} must match directory {skill_path.parent.name!r}")
    validation.require(1 <= len(description) <= 1024, f"Skill description must contain 1-1024 characters in {relative(skill_path)}")
    validation.require(line_count <= 500, f"{relative(skill_path)} should remain at or below 500 lines")
    validation.require(bool(fields.get("license", "")), f"Missing license field in {relative(skill_path)}")
    validation.require(LICENSE_PATH.is_file(), "Missing repository LICENSE")

    if "compatibility" in fields:
        compatibility = fields["compatibility"]
        validation.require(1 <= len(compatibility) <= 500, f"Compatibility must contain 1-500 characters in {relative(skill_path)}")

    validation.require(bool(metadata), f"Missing metadata mapping in {relative(skill_path)}")
    validation.require(all(bool(key) and bool(value) for key, value in metadata.items()), f"Metadata keys and values must be non-empty strings in {relative(skill_path)}")

    version = metadata.get("version", "")
    validation.require(bool(VERSION_PATTERN.fullmatch(version)), f"Invalid skill metadata version: {version!r}")
    if version:
        try:
            changelog = CHANGELOG_PATH.read_text(encoding="utf-8")
        except FileNotFoundError:
            validation.errors.append(f"Missing changelog: {relative(CHANGELOG_PATH)}")
        else:
            heading = re.compile(rf"^##\s+{re.escape(version)}(?:\s|$)", re.MULTILINE)
            validation.require(bool(heading.search(changelog)), f"CHANGELOG.md has no heading for skill version {version}")

    required_references: set[str]
    if name == "develop-fieldtwin-integration":
        integration_guide = skill_path.parent / "integration/README.md"
        validation.require(integration_guide.is_file(), f"Missing integration guide: {relative(integration_guide)}")
        required_references = DEVELOP_INTEGRATION_REFERENCES
        for filename in sorted(DEVELOP_INTEGRATION_FILES):
            required_file = skill_path.parent / filename
            validation.require(required_file.is_file(), f"Missing required skill file: {relative(required_file)}")
            if required_file.is_file():
                validation.require(bool(required_file.read_text(encoding="utf-8").strip()), f"Required skill file is empty: {relative(required_file)}")
        validate_api_attribute_catalogs(skill_path.parent, validation)
        validate_postmessage_catalog(skill_path.parent, validation)
    elif name == "create-fieldtwin-integration":
        required_references = CREATE_INTEGRATION_REFERENCES
    else:
        validation.errors.append(f"No package validation profile for skill {name!r}")
        required_references = set()

    references_path = skill_path.parent / "references"
    validation.require(references_path.is_dir(), f"Missing references directory: {relative(references_path)}")
    for filename in sorted(required_references):
        reference_path = references_path / filename
        validation.require(reference_path.is_file(), f"Missing required reference: {relative(reference_path)}")
        if reference_path.is_file():
            validation.require(bool(reference_path.read_text(encoding="utf-8").strip()), f"Required reference is empty: {relative(reference_path)}")


def validate_api_attribute_catalogs(skill_root: Path, validation: Validation) -> None:
    """Check that generated API catalogs retain broad, queryable contract coverage."""

    catalogs: dict[str, dict[str, object]] = {}
    for version in ("v1.10", "v2.0"):
        catalog_path = skill_root / "references" / f"api-attributes-{version}.json"
        try:
            catalogs[version] = json.loads(catalog_path.read_text(encoding="utf-8"))
        except FileNotFoundError:
            continue
        except json.JSONDecodeError as error:
            validation.errors.append(f"Invalid generated catalog {relative(catalog_path)}: {error.msg}")

    v110 = catalogs.get("v1.10")
    if v110:
        operations = v110.get("operations", [])
        validation.require(v110.get("apiVersion") == "v1.10", "v1.10 attribute catalog has the wrong apiVersion")
        validation.require(not v110.get("unresolvedApiUses"), "v1.10 attribute catalog has unresolved @apiUse definitions")
        validation.require(isinstance(operations, list) and len(operations) >= 250, "v1.10 attribute catalog lost operation coverage")
        attributes = [attribute for operation in operations for attribute in operation.get("attributes", [])]
        validation.require(len(attributes) >= 7_000, "v1.10 attribute catalog lost field coverage")
        validation.require(all(attribute.get("path") and attribute.get("location") for attribute in attributes), "v1.10 catalog contains an attribute without path/location")

    v2 = catalogs.get("v2.0")
    if v2:
        resources = v2.get("resources", {})
        streams = v2.get("streams", {})
        validation.require(v2.get("apiVersion") == "v2.0", "v2 attribute catalog has the wrong apiVersion")
        validation.require(isinstance(resources, dict) and len(resources) >= 100, "v2 attribute catalog lost readable resource coverage")
        validation.require(set(streams) == {"users", "accounts", "projects", "subProjects", "workflowTasks"}, "v2 attribute catalog has incomplete stream coverage")
        read_attributes = [attribute for resource in resources.values() for attribute in resource.get("attributes", [])]
        write_attributes = [
            attribute
            for stream in streams.values()
            for method in ("post", "patch", "delete")
            for resource in stream.get(method, {}).values()
            for attribute in resource.get("attributes", [])
        ]
        validation.require(len(read_attributes) >= 1_900, "v2 attribute catalog lost readable field coverage")
        validation.require(len(write_attributes) >= 2_000, "v2 attribute catalog lost writable field coverage")
        validation.require(all(attribute.get("path") for attribute in read_attributes + write_attributes), "v2 catalog contains an attribute without a path")
        operations = v2.get("operations", [])
        operation_attributes = [attribute for operation in operations for attribute in operation.get("attributes", [])]
        validation.require(isinstance(operations, list) and len(operations) >= 32, "v2 attribute catalog lost OpenAPI operation coverage")
        validation.require(len(operation_attributes) >= 7_000, "v2 attribute catalog lost OpenAPI field coverage")
        validation.require(all(attribute.get("path") and attribute.get("location") for attribute in operation_attributes), "v2 OpenAPI catalog contains an attribute without path/location")


def validate_postmessage_catalog(skill_root: Path, validation: Validation) -> None:
    """Check broad event, variant, direction, and field coverage in the client protocol catalog."""

    catalog_path = skill_root / "references" / "postmessage-attributes.json"
    try:
        catalog = json.loads(catalog_path.read_text(encoding="utf-8"))
    except FileNotFoundError:
        return
    except json.JSONDecodeError as error:
        validation.errors.append(
            f"Invalid generated catalog {relative(catalog_path)}: {error.msg}"
        )
        return

    messages = catalog.get("messages", [])
    validation.require(
        catalog.get("catalogVersion") == 1,
        "postMessage attribute catalog has the wrong catalogVersion",
    )
    validation.require(
        isinstance(messages, list) and len(messages) >= 90,
        "postMessage attribute catalog lost message-variant coverage",
    )
    directions = {message.get("direction") for message in messages}
    validation.require(
        directions == {"host-to-integration", "integration-to-host"},
        "postMessage attribute catalog has incomplete direction coverage",
    )
    events_by_direction = {
        direction: {
            message.get("event")
            for message in messages
            if message.get("direction") == direction
        }
        for direction in directions
    }
    validation.require(
        len(events_by_direction.get("host-to-integration", set())) >= 45,
        "postMessage attribute catalog lost host-to-integration event coverage",
    )
    validation.require(
        len(events_by_direction.get("integration-to-host", set())) >= 45,
        "postMessage attribute catalog lost integration-to-host event coverage",
    )
    fields = [field for message in messages for field in message.get("fields", [])]
    validation.require(
        len(fields) >= 850,
        "postMessage attribute catalog lost field coverage",
    )
    validation.require(
        all(
            message.get("event")
            and message.get("variant")
            and message.get("delivery")
            and isinstance(message.get("fields"), list)
            for message in messages
        ),
        "postMessage catalog contains an incomplete message record",
    )
    validation.require(
        all(
            field.get("path")
            and field.get("type")
            and isinstance(field.get("required"), bool)
            for field in fields
        ),
        "postMessage catalog contains an incomplete field record",
    )
    source_coverage = catalog.get("sourceCoverage") or {}
    validation.require(
        source_coverage.get("mainDispatchEventCount", 0) >= 40,
        "postMessage catalog lost main host-dispatch source coverage",
    )
    validation.require(
        not source_coverage.get("undocumentedMainDispatchEvents"),
        "postMessage catalog has undocumented main host-dispatch events",
    )


def validate_repository_shape(validation: Validation) -> None:
    """Require one canonical skills tree and reject platform-specific wrappers."""

    validation.require(SKILLS_ROOT.is_dir(), "Missing canonical skills directory")
    skill_files = sorted(SKILLS_ROOT.glob("*/SKILL.md")) if SKILLS_ROOT.is_dir() else []
    validation.require(bool(skill_files), "No skills/*/SKILL.md files found")
    for skill_file in skill_files:
        validate_skill(skill_file, validation)

    for required_path in sorted(REQUIRED_REPOSITORY_FILES):
        validation.require((REPOSITORY_ROOT / required_path).is_file(), f"Missing repository file: {required_path}")

    for path in REPOSITORY_ROOT.rglob("*"):
        if not path.is_file():
            continue
        path_value = relative(path)
        for forbidden_path in FORBIDDEN_PLATFORM_PATHS:
            if path_value == forbidden_path or path_value.endswith(f"/{forbidden_path}"):
                validation.errors.append(f"Platform-specific wrapper is not part of the canonical package: {path_value}")


def resolve_inside(base: Path, value: str, validation: Validation, label: str) -> Optional[Path]:
    """Resolve a relative path and prevent traversal outside the repository."""

    candidate = (base / value).resolve()
    try:
        candidate.relative_to(REPOSITORY_ROOT.resolve())
    except ValueError:
        validation.errors.append(f"{label} escapes the repository: {value}")
        return None
    return candidate


def validate_markdown_links(path: Path, text: str, validation: Validation) -> None:
    """Check that repository-relative Markdown targets exist and remain inside the repository."""

    for match in MARKDOWN_LINK_PATTERN.finditer(text):
        raw_target = (match.group(1) or match.group(2)).strip()
        if not raw_target or raw_target.startswith("#"):
            continue

        parsed = urlsplit(raw_target)
        if parsed.scheme or parsed.netloc:
            continue

        target_value = unquote(parsed.path)
        if not target_value:
            continue
        target = resolve_inside(path.parent, target_value, validation, f"Link in {relative(path)}")
        if target is not None:
            validation.require(target.exists(), f"Broken local link in {relative(path)}: {raw_target}")


def iter_public_text_files() -> list[Path]:
    """Return deterministic, UTF-8 publication files while excluding Git metadata."""

    files: list[Path] = []
    for path in REPOSITORY_ROOT.rglob("*"):
        if not path.is_file() or ".git" in path.parts:
            continue
        if path.suffix.lower() in SCANNED_SUFFIXES and path.stat().st_size <= 5_000_000:
            files.append(path)
    return sorted(files)


def validate_public_content(validation: Validation) -> None:
    """Reject private-data, credential, broken-link, and unsafe sample patterns."""

    unfinished_marker = "TO" + "DO"
    for path in iter_public_text_files():
        try:
            text = path.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            validation.errors.append(f"Publication file is not valid UTF-8: {relative(path)}")
            continue

        lowered = text.lower()
        if unfinished_marker.lower() in lowered:
            validation.errors.append(f"Unfinished marker found in {relative(path)}")

        for marker in PRIVATE_MARKERS:
            if marker.lower() in lowered:
                validation.errors.append(f"Private or internal marker {marker!r} found in {relative(path)}")

        for marker in PRIVATE_CASE_SENSITIVE_MARKERS:
            if marker in text:
                validation.errors.append(f"Private or internal marker {marker!r} found in {relative(path)}")

        for label, pattern in SECRET_PATTERNS:
            if pattern.search(text):
                validation.errors.append(f"Possible {label} found in {relative(path)}")

        executable_samples = text
        if path.suffix.lower() == ".md":
            executable_samples = "\n".join(MARKDOWN_FENCE_PATTERN.findall(text))
        if UNSAFE_POSTMESSAGE_PATTERN.search(executable_samples) or UNSAFE_TARGET_ORIGIN_PATTERN.search(executable_samples):
            validation.errors.append(f"Unsafe wildcard postMessage sample found in {relative(path)}")

        if path.suffix.lower() == ".json":
            try:
                json.loads(text)
            except json.JSONDecodeError as error:
                validation.errors.append(f"Invalid JSON in {relative(path)} at line {error.lineno}: {error.msg}")

        if path.suffix.lower() == ".md":
            validate_markdown_links(path, text, validation)


def main() -> int:
    """Run all checks and return a shell-friendly status code."""

    validation = Validation()
    validate_repository_shape(validation)
    validate_public_content(validation)

    if validation.errors:
        print(f"Package validation failed with {len(validation.errors)} error(s):", file=sys.stderr)
        for error in validation.errors:
            print(f"- {error}", file=sys.stderr)
        return 1

    print("FieldTwin Agent Skills package is valid.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
