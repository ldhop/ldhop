# Orphaned Cycles

## The Thought Process

This document is specifically concerned with cycles during deletion, and detecting orphaned cycles.

This is one possible approach to detecting and removing orphaned cycles. It's not sure it works.

Every hop leads to a node that has higher number than the previous. By 1 or more. It doesn't matter how much we increase in each hop, but let's say we add +1.

1 - path

```
1 - 2 - 3 - 4 - 5 - 6
        |
        4 - 5 - 6 - 7 - 8
            |           |
            12- 11- 10- 9
```

2 - expanded path

```
1 - 2 - 3 - 4-5-6 - 7
        |         ↙
        4 - 5 - 6 - 7 - 8
            |           |
            12- 11- 10- 9
```

How do I distinguish between genuinely held hops, and hops held by a cycle? I can always track them in reverse and see if they're held by a fixed point.

```
1 - 2 - 3 - 4-5-6 - 7
        |         ↙
        4 * 15.-8.- 9.- 10.
            |           |
            14.-13.-12.-11.
```

```
1 - 2 - 3 - 4-5-6 - 7
        |         * this 7 genuinely holds the 6
        4 * 23- 16- 17- 18
            |           | cycle detected
            22- 21- 20- 19
```

```
                    6 - 7 - 8
                  /
1 - 2 - 3 - 4 - 5 - 6 - 7 - 8
                  \
                    6 - 7 - 8
                    ↑       |
                    11- 10- 9
```

```
                    6 - 7 - 8
                  /
1 - 2 - 3 - 4 - 5 - 6 - 7 - 8
                  \         |
                    6 - 7 - 8
                    ↑       |
                    11- 10- 9
```

```
                    6 - 7 - 8
                  /         ↓
1 - 2 - 3 - 4 - 5 - 6 - 7 - 8
                  \         ↓
                    6 - 7 - 8
                    ↑       ↓
                    11- 10- 9
```

&darr; &uarr;

```
                    6 - 7 - 8
                  / ↑       ↓
1 - 2 - 3 - 4 - 5 - 6 - 7 - 8
                  x ↑       ↓
                    13 -14 -9
                    ↑       ↓
                    12- 11 -10
```

```
() <=> ()
```

```
                    6 - 7 - 8
                  / ↑       ↓
1 - 2 - 3 - 4 - 5 x 15 -16 -9
                    ↑       ↓
                    14 -15 -10
                    ↑       ↓
                    13 -12 -11
```

```
                    6 → 7 → 8
                  ↗ ↑       ↓
1 → 2 → 3 → 4 → 5 x 14 →15 →9
                    ↑       ↓
                    14 →15 →10
                    ↑       ↓
                    13 ←12 ←11
```

```
                    xx,→xx.→xx.
                  x ↑       |
1 - 2 - 3 - 4 - 5 x xx.→xx.→xx.
                    ↑       |
                    xx.-xx.-xx.
                    ↑       |
                    xx.-xx.-xx.
```

```
                    6 → 7 → 8
                  ↗ ↑       ↓
1 → 2 → 3 → 4 → 5   14 →15 →9
                    ↑       ↓
                    14 →15 →10
                    ↑       ↓
                    13 ←12 ←11
```

```
                    15.→16.→17.
                  x ↑       ↓
1 → 2 → 3 → 4 → 5   24.→15 →18.
                    ↑       ↓
                    23.→15 →19.
                    ↑       ↓
                    22.←21.←20.
```

```
                    xx.→16.→17.
                  x ↑       ↓
1 → 2 → 3 → 4 → 5   24.→25.→18.
                    ↑       ↓
                    23.→24.→19.
                    ↑       ↓
                    22.←21.←20.
```

```
                    xx.→xx.→xx.
                  x ↑       ↓
1 → 2 → 3 → 4 → 5   xx.→xx.→xx.
                    ↑       ↓
                    xx.→xx.→xx.
                    ↑       ↓
                    xx.←xx.←xx.
```

Ok, when you add numbers

&uarr; &rarr; &nearr;

Just make sure you prevent endless increasing. But how do I know? Is there a false-positive? Can I have to increase a point because a pressure from 2 points? No. When I increased it once, it should be stable. There's always a lowest increasing path, and when I have to increase a number twice, I'm already dealing with a cycle, because I hit myself to a tail, and there's nothing else holding the cycle.

This algorithm is not running always the same. The numbering is not always from the lowest. But it shouldn't matter, as long as there is an increase.

The starting variables are numbered 0, never to be deleted.

(n) → (n+1)

next = min(...previous) + 1

When adding, make the numbering such that every next node has some source of lower number.

When deleting or increasing number:

(x) -> (), (newx)

check every child and see if they still have a parent with lower number.

1. they have no parent => delete
1. they have parents, but none of them is lower => n = min(...parents) + 1, and color the updated node.
1. they have a parent with lower number => all is ok.

when you reach a colored child of lower number, do not increase its number. If it doesn't have a lower parent, it will be deleted.

(there might be yet-to-be colored parents, especially if going depth-first. This would be a problem.)

Uncolor everything.

```
1 → 2 → 3 → 4→5→6 → 7
        ↓         ↙
        4 → 5 → 6 → 7 → 8
            ↑           ↓
           12 ←11 ←10 ← 9
```

```
1 → 2 → 3 → 4→5→6 → 7
        *         ↙
        x xxx.→ 8.→ 9.→10.
            ↑           ↓
           14.←13.←12.←11.
```

```
1 → 2 → 3 → 4→5→6 * x
        *         x
        x →xx.→xx.→xx.→xx.
            ↑           ↓
           xx.←xx.←xx.←xx.
```

Will this work with multiple variables involved in each step though?

If Move is the node, and variables are the links, then yes, it can work.

## The Algorithm

Child - the target
Parent - the source

The starting variables are numbered 0.

When adding a node, number it the minimum of numbers of its parents + 1.

child = min(...parents) + 1

When deleting a node, or increasing node's number (as a result of deleting another node):

For every child of the affected node:

1. if it has no parent => delete
1. else if it has a parent with lower number => continue
1. else if it is colored => will be deleted when everything finishes.
1. else increase the number min(...parents) + 1 and color it

after this process is recursively finished, prune every colored node that has no parent of lower number.
