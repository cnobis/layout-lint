# layout-lint — Demo

This is the **MVP demo** for `layout-lint`, a JavaScript library + DSL for testing **CSS layout constraints** in web applications.

---

## What it does
- Defines layout rules in a small DSL (domain-specific language).  
- Parses these rules with a **Tree-sitter** grammar compiled to WebAssembly.  
- Evaluates them directly against the **live DOM**.  
- Reports whether constraints are satisfied.  

Example rule in DSL:

```
login below header 20px
```
→ Checks that the element `#login` is at least 20px below `#header`.

---

## Files in this folder

```
demo/
├── index.html # Demo UI (simple page with header + login button)
├── index.js # Runtime wrapper (parsing + evaluation logic)
├── layout_lint.wasm # Compiled Tree-sitter grammar for layout-lint
├── web-tree-sitter.js # Web Tree-sitter runtime (copied from node_modules)
├── tree-sitter.wasm # Core Tree-sitter runtime (copied from node_modules)
├── tree-sitter.js.map # Source map for debugging (optional)
```

---

## How it works
1. **index.html** loads the runtime and a simple DOM (header + login button).  
2. The `<pre id="spec">` element contains layout rules.  
3. `index.js`:
   - Loads `layout_lint.wasm` via WebAssembly.  
   - Parses rules into AST (abstract syntax tree).  
   - Resolves elements by their `id`.  
   - Measures DOM distances using `getBoundingClientRect()`.  
   - Compares with expected values.  
   - Renders ✅ (pass) or ❌ (fail) results.  

---

## Current features
- Relations: `below`, `above`, `left_of`, `right_of`  
- Distance comparison in pixels (e.g. `20px`)  
- Resolves elements by `id`  
- Pass/fail reporting in demo UI  

---

## Next steps (planned)
- More relations: `aligned-left`, `aligned-right`, `width`, `height`  
- Multiple rules per spec file  
- Tolerance (e.g. `≈ 20px`)  
- Highlight failing elements in DOM  
- Export results as JSON (CI/CD use case)  

---

## Running the demo
From the project root:

```bash
npm run serve
````

Then open:

```
http://localhost:8080/demo/
```
