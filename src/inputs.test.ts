import { Separator, handleString } from "./inputs";
import { expect, test } from "vitest";

test("converting strings into arrays", () => {
  type TestCase = {
    input: string;
    separator: Separator;
    expected: string[];
  };

  const testCases: TestCase[] = [
    // Properly formed strings
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
      input: "one two one-two-three",
      separator: "space",
      expected: ["one", "two", "one-two-three"],
    },
    // Malformed but still acceptable strings
    {
      input: "  foo bar     baz",
      separator: "space",
      expected: ["foo", "bar", "baz"],
    },
    {
      input: "one ,  two,  three",
      separator: "comma",
      expected: ["one", "two", "three"],
    },
    // Malformed with predictably dicey results
    {
      input: "  foo bar    ' foo bar baz'",
      separator: "space",
      expected: ["foo", "bar", "'", "foo", "bar", "baz'"],
    },
    {
      input: "  foo, bar,    ' foo bar baz'",
      separator: "comma",
      expected: ["foo", "bar", "' foo bar baz'"],
    },
    // Strings with the wrong separator (and predictably dicey output)
    {
      input: "foo bar baz",
      separator: "comma",
      expected: ["foo bar baz"],
    },
    {
      input: "foo,bar,baz",
      separator: "space",
      expected: ["foo,bar,baz"],
    },
    {
      input: "booper       bopper    mooper    mopper",
      separator: "comma",
      expected: ["booper       bopper    mooper    mopper"],
    },
  ];

  testCases.forEach(({ input, separator, expected }) =>
    expect(handleString(input, separator)).toStrictEqual(expected),
  );
});
