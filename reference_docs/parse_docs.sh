#!/bin/bash

# Parse all documentation files (outputs directly to ../docs/)
python parse_EidosHelpClasses.py
python parse_EidosHelpFunctions.py
python parse_EidosHelpOperators.py
python parse_EidosHelpTypes.py
python parse_SLiMHelpClasses.py
python parse_SLiMHelpFunctions.py
python parse_SLiMHelpCallbacks.py

echo "✅ All documentation parsed and written to docs/ folder"