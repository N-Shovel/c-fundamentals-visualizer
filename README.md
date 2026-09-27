# C Fundamentals Visualizer

An interactive, animated web walkthrough of **C fundamentals**. Every example runs step by step while the matching C code highlights line by line, so you can see the bytes, stack frames and pointers behind each line.

**Live demo:** https://n-shovel.github.io/c-fundamentals-visualizer/

It is a companion to [C Data Structures Visualizer](https://github.com/N-Shovel/c-data-structures-visualizer) ([live demo](https://n-shovel.github.io/c-data-structures-visualizer/)) and uses the same animation engine.

## Topics

| # | Topic | What you can run |
|---|---|---|
| 1 | **Variables & Types** | `int`, `char`, `double` shown as their real bytes (little-endian, IEEE-754), char overflow, `INT_MAX + 1`, integer division vs. casts |
| 2 | **Control Flow** | `for` (sum 1..n), `while` (digit sum), `if / else if` ladder (grades), `switch` with fall-through |
| 3 | **Functions & Stack** | recursive `factorial(n)` pushing and unwinding frames, swap by value vs. swap by pointer |
| 4 | **Arrays** | `arr[i]` address arithmetic, out-of-bounds reads, `p++`, sum, max, in-place reverse with two pointers |
| 5 | **Pointers** | `&` and `*`, `p = &x / &y`, `*p = v`, `**pp = v`, `NULL` and segfaults |
| 6 | **Strings** | char arrays with `'\0'`, ASCII codes, `strlen`, `toupper`, reverse, `strcpy`, missing terminator |
| 7 | **Structs** | `.` vs `->`, member offsets, struct copies, padding and alignment (`Bad` = 12 B vs `Good` = 8 B) |
| 8 | **Dynamic Memory** | stack vs. heap, `malloc`, `free`, `realloc`, memory leaks, dangling pointers, use-after-free, double free |

## Features

- **C code panel** that highlights the line being executed. Every snippet is browsable and copyable.
- **Step-by-step mode**: pause after every line and advance with **Next step**, → or Space.
- **Speed control** from 0.12 s to 1.8 s per step.
- **Execution log** that explains each step with the actual numbers (`74 >= 90 → false`, `0xfe00 + 3 × 4 = 0xfe0c`, and so on).
- **Key facts** table for each topic.
- If the input box is empty, a sensible random value is used.
- **Dark / light mode toggle** (moon/sun button in the header, or press **T**). It follows your OS setting until you pick one, then remembers your choice.

Addresses are shortened to 16 bits so they stay readable: stack variables sit near `0xff00` and heap blocks near `0x5a00`.

## Running locally

There's no build step and there are no dependencies. Open `index.html` in a browser, or serve the folder:

```bash
python -m http.server 8000
# then visit http://localhost:8000
```

Link straight to a topic with its hash, for example `index.html#pointers`.

## Project structure

```
index.html
css/style.css
js/core.js       # animated SVG scene, code panel, step control, base DS class
js/types.js      # Variables & Types
js/flow.js       # Control Flow
js/calls.js      # Functions & Stack
js/arrays.js     # Arrays
js/pointers.js   # Pointers
js/strings.js    # Strings
js/structs.js    # Structs
js/memory.js     # Dynamic Memory
js/main.js       # UI wiring
```

To add a topic, extend `DS` and implement `layout()` (it returns nodes and edges) plus async operation methods that call `await this.step(line, message)`. Then register the topic in `js/main.js` and add its `<script>` tag to `index.html`.
