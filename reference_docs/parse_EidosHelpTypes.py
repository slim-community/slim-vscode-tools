from bs4 import BeautifulSoup
import json
import re


def parse_type_docs(html_path):
    with open(html_path, "r", encoding="utf-8") as file:
        soup = BeautifulSoup(file, "html.parser")

    result = {}
    current_type = None

    # Find all paragraphs
    for p in soup.find_all("p"):
        text = p.get_text().strip()
        p_class = p.get("class", [])

        # Type definitions are in p1
        if "p1" in p_class:
            # Extract type name (e.g., "2.1.1 ITEM: 1. type integer")
            type_match = re.match(r"\d+\.\d+\.\d+\s+ITEM:\s+\d+\.\s+type\s+(\w+)", text)
            if type_match:
                type_name = type_match.group(1).strip()
                current_type = type_name
                result[current_type] = {"description": ""}
            continue

        # Type descriptions are in p2 and p3
        elif current_type and ("p2" in p_class or "p3" in p_class):
            result[current_type]["description"] += " " + text

    # Clean up descriptions (remove extra spaces)
    for type_info in result.values():
        type_info["description"] = type_info["description"].strip()

    return result


def main():
    html_path = "EidosHelpTypes.html"
    parsed_data = parse_type_docs(html_path)

    json_output_path = "../docs/eidos_types.json"
    with open(json_output_path, "w", encoding="utf-8") as json_file:
        json.dump(parsed_data, json_file, indent=4)


if __name__ == "__main__":
    main()
