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
    found_constructor = False
    last_method = None

    # First replace all br tags with newlines
    for br in soup.find_all("br"):
        br.replace_with("\n")

    # Find all paragraphs
    for p in soup.find_all("p"):
        text = p.get_text().strip()
        p_class = p.get("class", [""])[0]

        # Check for class headers (they typically have class names followed by "methods" or "properties")
        if p_class in ["p1", "p10"]:
            class_match = re.search(r"Class (\w+)", text)
            if class_match:
                current_class = class_match.group(1)
                result[current_class] = {
                    "constructor": {},
                    "methods": {},
                    "properties": {},
                }
                current_section = None
                last_property = None
                last_method = None
                continue

        if p_class in ["p2", "p9", "p11"]:
            if "properties" in text.lower():
                found_constructor = False
                current_section = "properties"
                last_method = None
            elif "methods" in text.lower():
                found_constructor = False
                current_section = "methods"
                last_method = None
            continue

        # Handle constructor
        if current_class and p_class == "p3":
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

        # Handle constructor description
        elif found_constructor and p_class in ["p4", "p6"] and current_class:
            result[current_class]["constructor"]["description"] += " " + text
            continue

        # Handle properties
        if current_section == "properties" and p_class in ["p3", "p5"]:
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
            and p_class in ["p4", "p6"]
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
        elif current_section == "methods" and p_class == "p3":
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
                last_method = method_name

        # Handle method descriptions and examples
        elif (
            current_section == "methods"
            and p_class in ["p4", "p5", "p6"]
            and last_method is not None
            and current_class
            and last_method in result[current_class]["methods"]
        ):
            # Add a newline before example code (p5) blocks
            prefix = "\n" if p_class == "p5" else " "
            result[current_class]["methods"][last_method]["description"] += (
                prefix + text
            )

    return result


def main():
    # Parse the documentation
    docs = parse_slim_docs("EidosHelpClasses.html")

    # Write the result to a JSON file in docs folder
    with open("../docs/eidos_classes.json", "w", encoding="utf-8") as f:
        json.dump(docs, f, indent=4)


if __name__ == "__main__":
    main()
