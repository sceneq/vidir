import {
  assertEquals,
  assertThrows,
} from "https://deno.land/std@0.217.0/assert/mod.ts";
import { splitLines, Action, planAction } from "./vidir.ts";

Deno.test("delete", () => {
  const before = splitLines(`
a
b
c
`);
  const after = splitLines(`
a
#b
c
`);
  const want: Action[] = [{ type: "Delete", name: "b" }];
  assertEquals(planAction(before, after), want);
});

Deno.test(
  "The number of input files does not match the number of output files",
  () => {
    const before = splitLines(`
a
b
c
`);
    const after = splitLines(`
a
c
`);
    assertThrows(
      () => planAction(before, after),
      "The number of input files does not match the number of output files"
    );
  }
);

Deno.test("move-and-delete", () => {
  const before = splitLines(`
a
b
c
`);
  const after = splitLines(`
#a
a
c
`);
  const want: Action[] = [
    { type: "Delete", name: "a" },
    { type: "Rename", oldName: "b", newName: "a" },
  ];
  assertEquals(planAction(before, after), want);
});

Deno.test("cycle-move", () => {
  const before = splitLines(`
a
b
c
`);
  const after = splitLines(`
b
c
a
`);
  // これは非効率的
  const want: Action[] = [
    { type: "Rename", oldName: "a", newName: "a.tmp.vidir" },
    { type: "Rename", oldName: "b", newName: "b.tmp.vidir" },
    { type: "Rename", oldName: "c", newName: "a" },
    { type: "Rename", oldName: "a.tmp.vidir", newName: "b" },
    { type: "Rename", oldName: "b.tmp.vidir", newName: "c" },
  ];
  assertEquals(planAction(before, after), want);
});
