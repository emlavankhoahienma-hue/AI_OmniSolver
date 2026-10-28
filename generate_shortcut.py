#!/usr/bin/env python3
"""
generate_shortcut.py
Generates Apple Shortcut file: AI_OmniSolver_Unsigned.shortcut
Compatible with iOS 16, 17, 18 & macOS 'shortcuts sign'.
"""

import sys
import uuid
import plistlib
from pathlib import Path

def create_text_token(var_name):
    """Creates a WFTextTokenString attachment dictionary for a named variable."""
    return {
        "WFSerializationType": "WFTextTokenAttachment",
        "Value": {
            "Type": "Variable",
            "VariableName": var_name
        }
    }

def create_interpolated_string(parts):
    """
    Creates a WFTextTokenString with embedded variable attachments.
    parts is a list of either string literals or ('var', var_name) tuples.
    """
    full_string = ""
    attachments = {}
    
    for part in parts:
        if isinstance(part, str):
            full_string += part
        elif isinstance(part, tuple) and part[0] == "var":
            var_name = part[1]
            pos = len(full_string)
            # Apple Shortcuts uses object replacement character \ufffc (￼)
            full_string += "\ufffc"
            attachments[f"{{{pos}, 1}}"] = {
                "Type": "Variable",
                "VariableName": var_name
            }
            
    return {
        "WFSerializationType": "WFTextTokenString",
        "Value": {
            "string": full_string,
            "attachmentsByRange": attachments
        }
    }

def build_omni_solver_shortcut():
    """Builds the complete WFWorkflowActions definition for AI Omni-Solver."""
    actions = []

    # 1. Config Dictionary
    actions.append({
        "WFWorkflowActionIdentifier": "is.workflow.actions.dictionary",
        "WFWorkflowActionParameters": {
            "UUID": str(uuid.uuid4()).upper(),
            "WFItems": {
                "WFSerializationType": "WFDictionaryFieldValue",
                "Value": {
                    "WFDictionaryFieldValueItems": [
                        {
                            "WFItemType": 0, # String
                            "WFKey": {
                                "WFSerializationType": "WFTextTokenString",
                                "Value": {"string": "API_KEY", "attachmentsByRange": {}}
                            },
                            "WFValue": {
                                "WFSerializationType": "WFTextTokenString",
                                "Value": {"string": "", "attachmentsByRange": {}}
                            }
                        },
                        {
                            "WFItemType": 0, # String
                            "WFKey": {
                                "WFSerializationType": "WFTextTokenString",
                                "Value": {"string": "ROUTER_URL", "attachmentsByRange": {}}
                            },
                            "WFValue": {
                                "WFSerializationType": "WFTextTokenString",
                                "Value": {"string": "https://text.pollinations.ai/openai", "attachmentsByRange": {}}
                            }
                        }
                    ]
                }
            }
        }
    })

    # 2. Set Config Variable
    actions.append({
        "WFWorkflowActionIdentifier": "is.workflow.actions.setvariable",
        "WFWorkflowActionParameters": {
            "WFVariableName": "Config"
        }
    })

    # 3. Take Screenshot silently
    actions.append({
        "WFWorkflowActionIdentifier": "is.workflow.actions.takescreenshot",
        "WFWorkflowActionParameters": {
            "UUID": str(uuid.uuid4()).upper()
        }
    })

    # 4. Set Variable: Screenshot
    actions.append({
        "WFWorkflowActionIdentifier": "is.workflow.actions.setvariable",
        "WFWorkflowActionParameters": {
            "WFVariableName": "Screenshot"
        }
    })

    # 5. Resize Image (Width: 1024, Preserve Aspect Ratio)
    actions.append({
        "WFWorkflowActionIdentifier": "is.workflow.actions.image.resize",
        "WFWorkflowActionParameters": {
            "UUID": str(uuid.uuid4()).upper(),
            "WFImageResizeWidth": 1024,
            "WFImageResizePreserveAspectRatio": True
        }
    })

    # 6. Set Variable: ResizedImage
    actions.append({
        "WFWorkflowActionIdentifier": "is.workflow.actions.setvariable",
        "WFWorkflowActionParameters": {
            "WFVariableName": "ResizedImage"
        }
    })

    # 7. Extract Text from Image (Apple Live Text OCR)
    actions.append({
        "WFWorkflowActionIdentifier": "is.workflow.actions.extracttextfromimage",
        "WFWorkflowActionParameters": {
            "UUID": str(uuid.uuid4()).upper()
        }
    })

    # 8. Set Variable: OCRText
    actions.append({
        "WFWorkflowActionIdentifier": "is.workflow.actions.setvariable",
        "WFWorkflowActionParameters": {
            "WFVariableName": "OCRText"
        }
    })

    # 9. Get ResizedImage
    actions.append({
        "WFWorkflowActionIdentifier": "is.workflow.actions.getvariable",
        "WFWorkflowActionParameters": {
            "WFVariable": create_text_token("ResizedImage")
        }
    })

    # 10. Base64 Encode (No line breaks)
    actions.append({
        "WFWorkflowActionIdentifier": "is.workflow.actions.base64encode",
        "WFWorkflowActionParameters": {
            "UUID": str(uuid.uuid4()).upper(),
            "WFBase64LineBreakMode": "None"
        }
    })

    # 11. Set Variable: Base64Image
    actions.append({
        "WFWorkflowActionIdentifier": "is.workflow.actions.setvariable",
        "WFWorkflowActionParameters": {
            "WFVariableName": "Base64Image"
        }
    })

    # 12. Get Config -> API_KEY
    actions.append({
        "WFWorkflowActionIdentifier": "is.workflow.actions.getvariable",
        "WFWorkflowActionParameters": {
            "WFVariable": create_text_token("Config")
        }
    })
    actions.append({
        "WFWorkflowActionIdentifier": "is.workflow.actions.getvalueforkey",
        "WFWorkflowActionParameters": {
            "UUID": str(uuid.uuid4()).upper(),
            "WFDictionaryKey": "API_KEY"
        }
    })
    actions.append({
        "WFWorkflowActionIdentifier": "is.workflow.actions.setvariable",
        "WFWorkflowActionParameters": {
            "WFVariableName": "UserKey"
        }
    })

    # 13. Get Config -> ROUTER_URL
    actions.append({
        "WFWorkflowActionIdentifier": "is.workflow.actions.getvariable",
        "WFWorkflowActionParameters": {
            "WFVariable": create_text_token("Config")
        }
    })
    actions.append({
        "WFWorkflowActionIdentifier": "is.workflow.actions.getvalueforkey",
        "WFWorkflowActionParameters": {
            "UUID": str(uuid.uuid4()).upper(),
            "WFDictionaryKey": "ROUTER_URL"
        }
    })
    actions.append({
        "WFWorkflowActionIdentifier": "is.workflow.actions.setvariable",
        "WFWorkflowActionParameters": {
            "WFVariableName": "TargetURL"
        }
    })

    # 14. Universal JSON Payload Text
    payload_token = create_interpolated_string([
        '{\n'
        '  "api_key": "', ('var', 'UserKey'), '",\n'
        '  "ocr_text": "', ('var', 'OCRText'), '",\n'
        '  "image_base64": "', ('var', 'Base64Image'), '",\n'
        '  "model": "openai",\n'
        '  "messages": [\n'
        '    {\n'
        '      "role": "system",\n'
        '      "content": "You are an elite instant exam solver. Output ONLY compact answers like 1B 2C 3A 4D or single number/word. Never explain."\n'
        '    },\n'
        '    {\n'
        '      "role": "user",\n'
        '      "content": [\n'
        '        {"type": "text", "text": "OCR Text:\\n', ('var', 'OCRText'), '\\n\\nSolve the quiz from image and OCR text:"},\n'
        '        {"type": "image_url", "image_url": {"url": "data:image/jpeg;base64,', ('var', 'Base64Image'), '"}}\n'
        '      ]\n'
        '    }\n'
        '  ]\n'
        '}'
    ])

    actions.append({
        "WFWorkflowActionIdentifier": "is.workflow.actions.gettext",
        "WFWorkflowActionParameters": {
            "UUID": str(uuid.uuid4()).upper(),
            "WFTextActionText": payload_token
        }
    })
    actions.append({
        "WFWorkflowActionIdentifier": "is.workflow.actions.setvariable",
        "WFWorkflowActionParameters": {
            "WFVariableName": "PayloadText"
        }
    })

    # 15. POST to TargetURL
    url_token = create_interpolated_string([('var', 'TargetURL')])
    actions.append({
        "WFWorkflowActionIdentifier": "is.workflow.actions.downloadurl",
        "WFWorkflowActionParameters": {
            "UUID": str(uuid.uuid4()).upper(),
            "WFURL": url_token,
            "WFHTTPMethod": "POST",
            "WFHTTPHeaders": {
                "WFSerializationType": "WFDictionaryFieldValue",
                "Value": {
                    "WFDictionaryFieldValueItems": [
                        {
                            "WFItemType": 0,
                            "WFKey": {
                                "WFSerializationType": "WFTextTokenString",
                                "Value": {"string": "Content-Type", "attachmentsByRange": {}}
                            },
                            "WFValue": {
                                "WFSerializationType": "WFTextTokenString",
                                "Value": {"string": "application/json", "attachmentsByRange": {}}
                            }
                        }
                    ]
                }
            },
            "WFHTTPBodyType": "File",
            "WFFormValues": create_text_token("PayloadText"),
            "ShowWhenRun": False
        }
    })
    actions.append({
        "WFWorkflowActionIdentifier": "is.workflow.actions.setvariable",
        "WFWorkflowActionParameters": {
            "WFVariableName": "ServerResponse"
        }
    })

    # 16. Parse Response (extract "result" from router or detect text)
    actions.append({
        "WFWorkflowActionIdentifier": "is.workflow.actions.getvalueforkey",
        "WFWorkflowActionParameters": {
            "UUID": str(uuid.uuid4()).upper(),
            "WFDictionaryKey": "result"
        }
    })
    actions.append({
        "WFWorkflowActionIdentifier": "is.workflow.actions.detect.text",
        "WFWorkflowActionParameters": {
            "UUID": str(uuid.uuid4()).upper()
        }
    })
    actions.append({
        "WFWorkflowActionIdentifier": "is.workflow.actions.setvariable",
        "WFWorkflowActionParameters": {
            "WFVariableName": "FinalAnswer"
        }
    })

    # 17. Stealth UX: Copy to Clipboard
    actions.append({
        "WFWorkflowActionIdentifier": "is.workflow.actions.getvariable",
        "WFWorkflowActionParameters": {
            "WFVariable": create_text_token("FinalAnswer")
        }
    })
    actions.append({
        "WFWorkflowActionIdentifier": "is.workflow.actions.setclipboard",
        "WFWorkflowActionParameters": {
            "WFLocalOnly": True
        }
    })

    # 18. Stealth UX: Notification Banner
    notif_body = create_interpolated_string([('var', 'FinalAnswer')])
    actions.append({
        "WFWorkflowActionIdentifier": "is.workflow.actions.notification",
        "WFWorkflowActionParameters": {
            "WFNotificationActionTitle": "🎯 AI Omni-Solver",
            "WFNotificationActionBody": notif_body,
            "WFNotificationActionSound": True
        }
    })

    # 19. Haptic Feedback (Vibrate)
    actions.append({
        "WFWorkflowActionIdentifier": "is.workflow.actions.vibrate",
        "WFWorkflowActionParameters": {}
    })

    # Complete Shortcut Structure
    shortcut_dict = {
        "WFWorkflowClientVersion": "2605.0.5",
        "WFWorkflowMinimumClientVersion": 900,
        "WFWorkflowMinimumClientVersionString": "900",
        "WFWorkflowIcon": {
            "WFWorkflowIconStartColor": 4282601983, # Deep Blue / Violet
            "WFWorkflowIconGlyphNumber": 59740     # Sparkle / AI Wand
        },
        "WFWorkflowTypes": ["NCWidget", "ActionExtension", "QuickLook"],
        "WFWorkflowInputContentItemClasses": [],
        "WFWorkflowImportQuestions": [
            {
                "ActionIndex": 0,
                "Category": "Parameter",
                "ParameterKey": "WFDictionaryValues",
                "Text": "Nhập API Key của bạn (Gemini AIza..., OpenRouter sk-or-..., Groq gsk_..., DeepSeek/OpenAI sk-...). Bỏ trống sẽ dùng Pollinations AI Miễn Phí 100%:"
            }
        ],
        "WFWorkflowActions": actions
    }

    return shortcut_dict

def main():
    output_path = Path("AI_OmniSolver_Unsigned.shortcut")
    if len(sys.argv) > 1:
        output_path = Path(sys.argv[1])

    print(f"[*] Generating Apple Shortcut: {output_path.name}...")
    shortcut_data = build_omni_solver_shortcut()

    with open(output_path, "wb") as f:
        plistlib.dump(shortcut_data, f, fmt=plistlib.FMT_BINARY)

    print(f"[+] Successfully wrote binary plist: {output_path} ({output_path.stat().st_size} bytes)")

    # Self-validation
    with open(output_path, "rb") as f:
        reloaded = plistlib.load(f)
    action_count = len(reloaded.get("WFWorkflowActions", []))
    print(f"[+] Verified {action_count} actions successfully loaded!")

if __name__ == "__main__":
    main()
