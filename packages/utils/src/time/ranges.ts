/** The read side of DOM `TimeRanges`, which browser ranges and DOM-free range implementations both satisfy. */
export interface TimeRangesLike {
  readonly length: number;
  start(index: number): number;
  end(index: number): number;
}

/** Converts a time ranges object to an array of [start, end] tuples. */
export function serializeTimeRanges(ranges: TimeRangesLike): Array<[number, number]> {
  const result: Array<[number, number]> = [];

  for (let i = 0; i < ranges.length; i++) {
    result.push([ranges.start(i), ranges.end(i)]);
  }

  return result;
}
