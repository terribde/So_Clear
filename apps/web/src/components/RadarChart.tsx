import { SCORE_DIMENSIONS, type ScoreSet } from '@soclear/contracts';
import { useId } from 'react';
import { formatScore } from '../lib/format';

interface RadarChartProps {
  scores: ScoreSet;
}

export function RadarChart({ scores }: RadarChartProps) {
  const titleId = useId();
  const centerX = 180;
  const centerY = 166;
  const maxRadius = 106;
  const labelRadius = 120;

  const angleFor = (index: number) => (-Math.PI / 2) + index * (Math.PI / 2);
  const point = (index: number, radius: number) => {
    const angle = angleFor(index);
    return [centerX + Math.cos(angle) * radius, centerY + Math.sin(angle) * radius] as const;
  };
  const polygon = (radius: number) =>
    SCORE_DIMENSIONS.map((_, index) => point(index, radius).join(',')).join(' ');

  const dataPolygon = SCORE_DIMENSIONS.map((dimension, index) =>
    point(index, (scores[dimension.key] / 5) * maxRadius).join(','),
  ).join(' ');

  const anchors: Array<'middle' | 'start' | 'end'> = ['middle', 'start', 'middle', 'end'];
  const labelOffsets = [
    { x: 0, y: -8 },
    { x: 6, y: 4 },
    { x: 0, y: 18 },
    { x: -6, y: 4 },
  ];

  return (
    <div>
      <svg
        viewBox="0 0 360 344"
        className="mx-auto block w-full max-w-[390px]"
        role="img"
        aria-labelledby={titleId}
      >
        <title id={titleId}>
          四维评分雷达图：
          {SCORE_DIMENSIONS.map(
            (dimension) => `${dimension.label} ${formatScore(scores[dimension.key])} 分`,
          ).join('，')}
        </title>

        {[1, 2, 3, 4, 5].map((level) => (
          <polygon
            key={level}
            points={polygon((level / 5) * maxRadius)}
            fill={level === 5 ? '#f2f8f5' : 'none'}
            stroke="#dfe9e3"
            strokeWidth="1"
          />
        ))}

        {SCORE_DIMENSIONS.map((dimension, index) => {
          const [x, y] = point(index, maxRadius);
          return (
            <line
              key={dimension.key}
              x1={centerX}
              y1={centerY}
              x2={x}
              y2={y}
              stroke="#e3ece7"
              strokeWidth="1"
            />
          );
        })}

        <polygon points={dataPolygon} fill="#1f7259" fillOpacity="0.14" stroke="#1f7259" strokeWidth="2" strokeLinejoin="round" />

        {SCORE_DIMENSIONS.map((dimension, index) => {
          const [x, y] = point(index, (scores[dimension.key] / 5) * maxRadius);
          return <circle key={dimension.key} cx={x} cy={y} r="3.4" fill="#1f7259" />;
        })}

        {SCORE_DIMENSIONS.map((dimension, index) => {
          const [x, y] = point(index, labelRadius);
          const offset = labelOffsets[index]!;
          return (
            <g key={dimension.key}>
              <text
                x={x + offset.x}
                y={y + offset.y}
                textAnchor={anchors[index]}
                fill="#4c6359"
                fontSize="12"
                fontWeight="600"
              >
                {dimension.label}
              </text>
              <text
                x={x + offset.x}
                y={y + offset.y + 17}
                textAnchor={anchors[index]}
                fill="#1f7259"
                fontSize="11.5"
                fontWeight="700"
              >
                {formatScore(scores[dimension.key])}
              </text>
            </g>
          );
        })}
      </svg>
      <p className="mt-1 text-center text-[11px] text-ink-400">越靠外表示该项评价越好 · 满分 5 分</p>
    </div>
  );
}
