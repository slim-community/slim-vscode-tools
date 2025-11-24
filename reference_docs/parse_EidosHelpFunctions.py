#!/usr/bin/env python3

from bs4 import BeautifulSoup
import json
import re


def parse_function_docs(html_path):
    with open(html_path, "r", encoding="utf-8") as file:
        soup = BeautifulSoup(file, "html.parser")

    result = {}
    current_section = None
    current_function = None

    # First replace all br tags with newlines
    for br in soup.find_all("br"):
        br.replace_with("\n")

    # Find all paragraphs
    for p in soup.find_all("p"):
        text = p.get_text().strip()
        p_class = p.get("class", [])

        print(f"Found paragraph with class {p_class}: {text[:50]}...")  # Debug print

        # Section headers are in p1
        if "p1" in p_class:
            # Extract section number and name (e.g., "3.1. Math functions")
            section_match = re.match(r"\d+\.\d+\.\s+(.*)", text)
            if section_match:
                current_section = section_match.group(1).strip()
                result[current_section] = {}
                current_function = None
                print(f"Found section: {current_section}")  # Debug print
            else:
                print(f"Failed to match section in: {text}")  # Debug print
            continue

        # Function signatures are in p2 and p4
        elif any(c in p_class for c in ["p2", "p4"]):
            # Function signatures might have multiple forms separated by newlines
            signatures = text.split("\n")
            for signature in signatures:
                signature = signature.strip()
                if signature:
                    # Try to extract function name from signature
                    func_match = re.match(r"\((.*?)\)\s*(\w+)\s*\(", signature)
                    if func_match:
                        function_name = func_match.group(2)
                        if current_section:
                            if function_name not in result[current_section]:
                                result[current_section][function_name] = {
                                    "signatures": [],
                                    "description": "",
                                }
                            result[current_section][function_name]["signatures"].append(
                                signature
                            )
                            current_function = function_name
                            print(
                                f"Found function: {function_name} in section {current_section}"
                            )  # Debug print
                    else:
                        print(
                            f"Failed to match function in: {signature}"
                        )  # Debug print
            continue

        # Function descriptions are in p3 and p5
        elif (
            any(c in p_class for c in ["p3", "p5"])
            and current_section
            and current_function
        ):
            result[current_section][current_function]["description"] += " " + text
            print(f"Added description for: {current_function}")  # Debug print

    # Print final structure before cleanup
    print("\nBefore cleanup:")
    for section, functions in result.items():
        print(f"\nSection: {section}")
        for func, details in functions.items():
            print(f"  Function: {func}")
            print(f"    Signatures: {details['signatures']}")
            print(f"    Description: {details['description'][:50]}...")

    # Clean up descriptions (remove extra spaces)
    for section in result.values():
        for func in section.values():
            func["description"] = func["description"].strip()

    return result


def main():
    # Parse the documentation
    docs = parse_function_docs("EidosHelpFunctions.html")

    # Print the structure before writing
    print("\nParsed structure:")
    for section, functions in docs.items():
        print(f"\nSection: {section}")
        print(f"Number of functions: {len(functions)}")

    # Write the result to a JSON file in docs folder
    with open("../docs/eidos_functions.json", "w", encoding="utf-8") as f:
        json.dump(docs, f, indent=4)


if __name__ == "__main__":
    main()
