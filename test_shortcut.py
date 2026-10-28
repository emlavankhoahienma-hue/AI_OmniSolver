#!/usr/bin/env python3
"""
test_shortcut.py - Validates AI_OmniSolver shortcut structure and action graph.
"""

import plistlib
import sys
from pathlib import Path

def test_shortcut_file(filepath="AI_OmniSolver_Unsigned.shortcut"):
    p = Path(filepath)
    if not p.exists():
        print(f"[-] File not found: {filepath}")
        return False

    with open(p, "rb") as f:
        data = plistlib.load(f)

    # 1. Check Root Fields
    required_keys = [
        "WFWorkflowActions",
        "WFWorkflowClientVersion",
        "WFWorkflowIcon",
        "WFWorkflowTypes",
    ]
    for k in required_keys:
        assert k in data, f"Missing required root key: {k}"

    actions = data["WFWorkflowActions"]
    assert len(actions) > 10, f"Expected >10 actions, got {len(actions)}"

    # 2. Check Action Identifiers
    identifiers = [a.get("WFWorkflowActionIdentifier") for a in actions]
    
    expected_actions = [
        "is.workflow.actions.takescreenshot",
        "is.workflow.actions.image.resize",
        "is.workflow.actions.extracttextfromimage",
        "is.workflow.actions.base64encode",
        "is.workflow.actions.downloadurl",
        "is.workflow.actions.setclipboard",
        "is.workflow.actions.notification",
    ]

    for expected in expected_actions:
        assert expected in identifiers, f"Missing expected action: {expected}"

    # 3. Check Base64 settings (LineBreakMode: None)
    base64_action = next(a for a in actions if a.get("WFWorkflowActionIdentifier") == "is.workflow.actions.base64encode")
    assert base64_action["WFWorkflowActionParameters"].get("WFBase64LineBreakMode") == "None", "Base64 line breaks must be None!"

    # 4. Check Resize image settings (width: 1024)
    resize_action = next(a for a in actions if a.get("WFWorkflowActionIdentifier") == "is.workflow.actions.image.resize")
    assert resize_action["WFWorkflowActionParameters"].get("WFImageResizeWidth") == 1024, "Image resize width must be 1024!"

    print(f"[PASS] ALL SHORTCUT VALIDATION CHECKS PASSED for {filepath}!")
    return True

if __name__ == "__main__":
    path = sys.argv[1] if len(sys.argv) > 1 else "AI_OmniSolver_Unsigned.shortcut"
    ok = test_shortcut_file(path)
    sys.exit(0 if ok else 1)
