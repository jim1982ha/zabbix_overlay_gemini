import { UnifiedQueryResponse } from '../interfaces/plugins';

/**
 * Normalizes and blends disparate datasets from different plugins along a unified UTC Unix MS timeline.
 */
export function blendTimeseriesData(responses: UnifiedQueryResponse[]): any[] {
  const timeMap = new Map<number, Record<string, any>>();

  responses.forEach((response, index) => {
    const seriesKey = response.target.label || response.target.semanticPathway.join(' > ') || `Series ${index + 1}`;
    
    response.datapoints.forEach(([timestamp, value]) => {
      // Create bucket if it doesn't exist securely aligning on exact timestamp
      if (!timeMap.has(timestamp)) {
        timeMap.set(timestamp, { timestamp });
      }
      const point = timeMap.get(timestamp)!;
      point[seriesKey] = value;
    });
  });

  // Recharts requires sorted timeline arrays to render X axis without artifacts
  return Array.from(timeMap.values()).sort((a, b) => a.timestamp - b.timestamp);
}
