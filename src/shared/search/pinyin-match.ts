// Full pinyin may end partway through the last syllable while typing, but it
// must begin at a Hanzi boundary: kaw -> ka|wang, never ai -> c|ai.
// Initials already have one character per syllable, so every offset is valid.
export function findPinyinMatchIndex(
  value: string,
  query: string,
  syllableStarts: readonly number[] | null,
  fromIndex = 0
): number {
  if (!/^[a-z]{2,}$/.test(query)) return -1
  let index = value.indexOf(query, fromIndex)
  while (index >= 0) {
    if (syllableStarts === null || syllableStarts.includes(index)) return index
    index = value.indexOf(query, index + 1)
  }
  return -1
}
