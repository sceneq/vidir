export type Action =
  | { type: "Rename"; oldName: string; newName: string }
  | { type: "Delete"; name: string };

export function splitLines(s: string): string[] {
  return s
    .trim()
    .split("\n")
    .filter((line) => line.trim() !== "");
}

export function planAction(
  beforeLines: string[],
  afterLines: string[]
): Action[] {
  if (beforeLines.length !== afterLines.length) {
    throw new Error(
      "The number of input files does not match the number of output files"
    );
  }

  const renameList: {
    oldName: string;
    newName: string;
  }[] = [];

  beforeLines.forEach((oldName, index) => {
    const newName = afterLines[index];
    if (newName.startsWith("#")) {
      return;
    }
    if (oldName !== newName) {
      renameList.push({ oldName, newName });
    }
  });

  const renameSet = new Set(renameList.map((e) => e.oldName));
  for (let i = 0; i < renameList.length; i++) {
    const e = renameList[i];
    if (renameSet.has(e.newName)) {
      // 1. old -> tmp
      // 2. tmp -> new
      const tmp = `${e.oldName}.tmp.vidir`;
      renameList.push({
        oldName: tmp,
        newName: renameList[i].newName,
      });
      renameList[i].newName = tmp;
    }
    renameSet.delete(e.oldName);
  }

  const actions: Action[] = [];

  for (const line of afterLines) {
    if (!line.trim().startsWith("#")) {
      continue;
    }
    const name = line.substring(1).trim();
    actions.push({ type: "Delete", name });
  }

  for (const e of renameList) {
    actions.push({ type: "Rename", oldName: e.oldName, newName: e.newName });
  }

  return actions;
}

export async function vidir() {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder("utf-8");

  const items = [];
  for await (const dirEntry of Deno.readDir(Deno.cwd())) {
    items.push(dirEntry.name);
  }

  const tmpFilePath = await Deno.makeTempFile({
    prefix: "tmp-",
    suffix: ".vidir",
  });
  await Deno.writeFile(tmpFilePath, encoder.encode(items.join("\n")));

  let editor = Deno.env.get("EDITOR");
  if (!editor) {
    editor = "vim";
  }

  const command = new Deno.Command(editor, {
    args: [tmpFilePath],
    stdin: "inherit",
    stdout: "inherit",
    stderr: "inherit",
  });
  const ret = await command.output();
  if (ret.code !== 0) {
    console.error(`${editor} exit with ${ret.code}`);
    return;
  }

  const afterContent = await Deno.readFile(tmpFilePath);
  const after = decoder.decode(afterContent);
  const afterLines = splitLines(after);

  const actions = planAction(items, afterLines);

  // 常にdry run
  console.log(actions);

  await Deno.remove(tmpFilePath);
}
