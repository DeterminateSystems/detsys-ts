import { Separator, handleString } from "./inputs";
import { expect, test } from "vitest";

test("converting strings into arrays", () => {
  type TestCase = {
    input: string;
    separator: Separator;
    expected: string[];
  };

  const testCases: TestCase[] = [
    {
      input: "one,two,three",
      separator: "comma",
      expected: ["one", "two", "three"],
    },
    {
      input: "one two three",
      separator: "space",
      expected: ["one", "two", "three"],
    },
    {
      input: "  foo bar     baz",
      separator: "space",
      expected: ["foo", "bar", "baz"],
    },
    {
      input: "   foo,   bar,  baz",
      separator: "comma",
      expected: ["foo", "bar", "baz"],
    },
    {
      input: "booper",
      separator: "comma",
      expected: ["booper"],
    },
    {
      input: "booper bopper mooper mopper",
      separator: "comma",
      expected: ["booperboppermoopermopper"],
    },
  ];

  testCases.forEach(({ input, separator, expected }) =>
    expect(handleString(input, separator)).toStrictEqual(expected),
  );
});
