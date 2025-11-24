#!/usr/bin/env python3

from bs4 import BeautifulSoup
import json
import re


def parse_operator_docs(html_path):
    with open(html_path, "r", encoding="utf-8") as file:
        soup = BeautifulSoup(file, "html.parser")

    result = {}
    current_operator = None

    # Find all paragraphs
    for p in soup.find_all("p"):
        text = p.get_text().strip()
        p_class = p.get("class", [])

        # Debugging: Print the text of each paragraph
        print(f"Processing paragraph: {text}")

        # Operator definitions are identified by "ITEM: "
        if "ITEM: " in text:
            # Extract operator name and symbols
            operator_match = re.match(r".*?M:\s+\d+\.\s+(.*operators?):\s+(.+)", text)
            if operator_match:
                operator_name = operator_match.group(1).strip()
                operator_symbols = operator_match.group(2).strip()
                current_operator = f"{operator_name} {operator_symbols}"
                result[current_operator] = {
                    "signature": operator_symbols,
                    "description": "",
                }
                # Debugging: Print the matched operator
                print(f"Matched operator: {current_operator}")
            else:
                # Handle single operator case
                operator_match = re.match(
                    r".*?ITEM:\s+\d+\.\s+(.*operator)\s+(\S+)", text
                )
                if operator_match:
                    operator_name = operator_match.group(1).strip()
                    operator_symbol = operator_match.group(2).strip()
                    current_operator = f"{operator_name} {operator_symbol}"
                    result[current_operator] = {
                        "signature": operator_symbol,
                        "description": "",
                    }
                    # Debugging: Print the matched operator
                    print(f"Matched operator: {current_operator}")
                else:
                    # Handle cases like "ITEM: 12. Method calls: operator () and operator ."
                    operator_match = re.match(
                        r".*?ITEM:\s+\d+\.\s+(.*):\s+operator\s+(\S+)\s+and\s+operator\s+(\S+)",
                        text,
                    )
                    if operator_match:
                        operator_name = operator_match.group(1).strip()
                        operator_symbol1 = operator_match.group(2).strip()
                        operator_symbol2 = operator_match.group(3).strip()
                        current_operator = (
                            f"{operator_name} {operator_symbol1} and {operator_symbol2}"
                        )
                        result[current_operator] = {
                            "signature": f"{operator_symbol1} and {operator_symbol2}",
                            "description": "",
                        }
                        # Debugging: Print the matched operator
                        print(f"Matched operator: {current_operator}")
            continue

        # Operator descriptions are in p2, p3, p4, p5, and p6
        elif current_operator and (
            "p2" in p_class
            or "p3" in p_class
            or "p4" in p_class
            or "p5" in p_class
            or "p6" in p_class
        ):
            result[current_operator]["description"] += " " + text
            # Debugging: Print the current description
            print(
                f"Updated description for {current_operator}: {result[current_operator]['description']}"
            )
        else:
            current_operator = None

    # Clean up descriptions (remove extra spaces)
    for operator_info in result.values():
        operator_info["description"] = operator_info["description"].strip()

    return result


def main():
    html_path = "EidosHelpOperators.html"
    parsed_data = parse_operator_docs(html_path)

    json_output_path = "../docs/eidos_operators.json"
    with open(json_output_path, "w", encoding="utf-8") as json_file:
        json.dump(parsed_data, json_file, indent=4)


if __name__ == "__main__":
    main()
