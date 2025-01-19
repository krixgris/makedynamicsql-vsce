# makedynsql README

Toolset for making it easier to convert SQL scripts to dynamic sql including parameter extraction and replacements.
## Features

## Requirements


## Extension Settings


This extension contributes the following settings:

* `makedynsql.makeDynamic`: Replaces and makes dynsql
* `makedynsql.unJoinLines`: Splits lines into rows and preserve indentation. Reverse of join, thus unjoin
* `makedynsql.unJoinLinesAnd`: Splits lines into rows and preserve indentation. Reverse of join, thus unjoin
* `makedynsql.unJoinLinesOR`: Splits lines into rows and preserve indentation. Reverse of join, thus unjoin

## Known Issues


## Release Notes

## Example config
// Example keybindings.json
```[
    {
        "key": "ctrl+u",
        "command": "makedynsql.unJoinLines"
    },
    {
        "key": "ctrl+alt+u",
        "command": "makedynsql.unJoinLines",
        "args": {
            "delimiter": "and",
            "padding": true,
            "reapplyPadding": true,
        }
    },
    {
        "key": "ctrl+alt+p",
        "command": "makedynsql.unJoinLines",
        "args": {
            "delimiter": "and",
            "delimiterNewline": false,
            "padding": true,
            "ignoreParentheses": false,
            "reapplyPadding": true,
        }
    },
    {
        "key": "ctrl+alt+o",
        "command": "makedynsql.unJoinLines",
        "args": {
            "delimiter": "or",
            "padding": true,
            "reapplyPadding": true,
        }
    },
    {
        "key": "ctrl+alt+l",
        "command": "makedynsql.unJoinLines",
        "args": {
            "delimiter": "   ",
            "padding": false,
            "reapplyPadding": false,
        }
    },
]
```

### 0.3.1


---


