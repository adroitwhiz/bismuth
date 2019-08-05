# To do
- **Refactor the code**
	- Annotate/comment the code
		- Switch to a proper request library
	- Rewrite compiler
- New code generator
	1. Parse sb2/sb3 to block format
	2. Compile blocks into IR (handle control flow, etc. for continuations)
	3. Interpret IR and/or transpile to JS
- Switch to scratch-render
- Redo frontend/HTML
	- Vue?