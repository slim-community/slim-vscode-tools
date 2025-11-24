import json


def find_global_creating_methods(file_path):
    with open(file_path, "r") as file:
        data = json.load(file)

    global_creating_methods = []

    for class_name, class_info in data.items():
        if "methods" in class_info:
            for method_name, method_info in class_info["methods"].items():
                description = method_info.get("description", "")
                if (
                    "defined as a global variable" in description
                    or "global variable" in description
                ):
                    global_creating_methods.append(
                        {
                            "class": class_name,
                            "method": method_name,
                            "description": description,
                        }
                    )

    return global_creating_methods


file_path = "../docs/slim_classes.json"
global_creating_methods = find_global_creating_methods(file_path)

for method in global_creating_methods:
    print(f"Class: {method['class']}, Method: {method['method']}")
    print(f"Description: {method['description']}\n")
