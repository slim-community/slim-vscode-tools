#!/usr/bin/env python3

from bs4 import BeautifulSoup
import json
import re


def parse_callback_docs(html_path):
    with open(html_path, "r", encoding="utf-8") as file:
        soup = BeautifulSoup(file, "html.parser")

    result = {}
    current_callback = None

    # First replace all br tags with newlines
    for br in soup.find_all("br"):
        br.replace_with("\n")

    # Find all paragraphs
    for p in soup.find_all("p"):
        text = p.get_text().strip()
        p_class = p.get("class", [])

        # Callback signatures are in p1
        if "p1" in p_class:
            # Extract callback name (e.g., "initialize() callbacks" or "Eidos events")
            callback_match = re.search(
                r"ITEM: \d+\.\s+(.*?)\s+(callbacks|events)", text
            )
            if callback_match:
                current_callback = f"{callback_match.group(1).strip()} {callback_match.group(2).strip()}"
                result[current_callback] = {
                    "signature": current_callback,
                    "description": "",
                }
            continue

        # Callback descriptions are in p2 and other paragraph classes
        elif current_callback:
            result[current_callback]["description"] += " " + text

    # Clean up descriptions (remove extra spaces)
    for callback in result.values():
        callback["description"] = callback["description"].strip()

    return result


def main():
    html_path = "/Users/adk/github/slim-tools/reference_docs/SLiMHelpCallbacks.html"
    parsed_data = parse_callback_docs(html_path)

    json_output_path = "/Users/adk/github/slim-tools/reference_docs/slim_callbacks.json"
    with open(json_output_path, "w", encoding="utf-8") as json_file:
        json.dump(parsed_data, json_file, indent=4)


if __name__ == "__main__":
    main()
