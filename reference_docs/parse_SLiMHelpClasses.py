#!/usr/bin/env python3

from bs4 import BeautifulSoup
import json
import re


def parse_signature(signature_text):
    """Parse a method signature into a clean format."""
    # Remove any HTML tags and clean up the signature
    return signature_text.strip()


def parse_property_type(property_line):
    """Extract property type from the property declaration line."""
    type_match = re.search(r"\((.*?)\)", property_line)
    if type_match:
        return type_match.group(1)
    return "unknown"


def parse_slim_docs(html_path):
    with open(html_path, "r", encoding="utf-8") as file:
        soup = BeautifulSoup(file, "html.parser")

    result = {}
    current_class = None
    current_section = None  # 'methods' or 'properties'
    last_property = None
    found_constructor = False  # Added for constructor handling

    # Find all paragraphs
    for p in soup.find_all("p"):
        text = p.get_text().strip()

        # Check for class headers (they typically have class names followed by "methods" or "properties")
        if p.get("class") in [["p1"], ["p10"]]:
            class_match = re.search(r"Class (\w+)", text)
            if class_match:
                current_class = class_match.group(1)
                # Add constructor dict to result structure
                result[current_class] = {
                    "constructor": {},  # Added for constructor handling
                    "methods": {},
                    "properties": {},
                }
                current_section = None
                last_property = None
                found_constructor = False  # Reset constructor flag
                continue

        if p.get("class") in [["p2"], ["p9"], ["p11"]]:
            if "properties" in text.lower():
                found_constructor = False  # Reset constructor flag
                current_section = "properties"
            elif "methods" in text.lower():
                found_constructor = False  # Reset constructor flag
                current_section = "methods"
            continue

        # Handle constructor
        if current_class and p.get("class") in [["p3"], ["p5"]]:  # Added p5
            constructor_match = re.match(
                r"\(object<" + current_class + r">\$\)" + current_class + r"\(.*\)",
                text,
            )
            if constructor_match:
                result[current_class]["constructor"] = {
                    "signature": text,
                    "description": "",  # Will be filled in next paragraph
                }
                found_constructor = True
                continue

        # Handle constructor description - Added this section
        elif found_constructor and p.get("class") in [["p4"], ["p6"]] and current_class:
            result[current_class]["constructor"]["description"] += " " + text
            continue

        # Handle properties
        if current_section == "properties" and p.get("class") in [["p3"], ["p5"]]:
            property_match = re.match(
                r"([\w\d_]+)\s*(?:<–>|&lt;–&gt;|<->|=>|\s*<span.*?>&lt;–&gt;</span>)?\s*\(([^)]+)\)",
                text,
            )
            if property_match:
                property_name = property_match.group(1).strip()
                property_type = property_match.group(2).strip()
                if current_class:
                    result[current_class]["properties"][property_name] = {
                        "type": property_type,
                        "description": "",  # Will be filled by next paragraph
                    }
                    last_property = property_name
            else:
                # Handle properties without type
                property_match = re.match(
                    r"([\w\d_]+)\s*(?:&lt;–&gt;|<->|=>)\s*\(([^)]+)\)", text
                )
                if property_match:
                    property_name = property_match.group(1).strip()
                    if current_class:
                        result[current_class]["properties"][property_name] = {
                            "type": "unknown",
                            "description": "",  # Will be filled by next paragraph
                        }
                        last_property = property_name

        # Handle property descriptions
        elif (
            current_section == "properties"
            and p.get("class") in [["p4"], ["p6"]]
            and current_class
            and last_property
        ):
            # Add description to the last added property
            if last_property in result[current_class]["properties"]:
                result[current_class]["properties"][last_property]["description"] += (
                    " " + text
                )
            else:
                print(
                    f"⚠️ Warning: Tried to add a description to a non-existent property '{last_property}' in class '{current_class}'"
                )

        # Handle methods
        elif current_section == "methods" and p.get("class") in [["p3"], ["p5"]]:
            method_match = re.match(
                r"[–+\-]\s*[\xa0 ]*\((.*?)\)\s*([\w\d_]+)\s*\((.*)\)", text
            )
            if method_match and current_class:
                method_name = method_match.group(2).strip()
                signature = (
                    f"({method_match.group(1)}){method_name}({method_match.group(3)})"
                )
                result[current_class]["methods"][method_name] = {
                    "signature": signature,
                    "description": "",  # Will be filled by next paragraph
                }
                print(
                    f"✅ Found method: {method_name} in class {current_class}"
                )  # Debugging
            else:
                print(f"❌ No match for: {repr(text)}")  # Show the exact raw text

        # Handle method descriptions
        elif (
            current_section == "methods"
            and p.get("class") in [["p4"], ["p6"]]
            and current_class
        ):
            # Add description to the last added method
            if result[current_class]["methods"]:
                last_method = list(result[current_class]["methods"].keys())[-1]
                result[current_class]["methods"][last_method]["description"] += (
                    " " + text
                )

    return result


def main():
    # Parse the documentation
    docs = parse_slim_docs("SLiMHelpClasses.html")

    # Write the result to a JSON file in docs folder
    with open("../docs/slim_classes.json", "w", encoding="utf-8") as f:
        json.dump(docs, f, indent=4)


if __name__ == "__main__":
    main()
