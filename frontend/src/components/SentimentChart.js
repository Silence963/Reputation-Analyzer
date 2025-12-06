import React from "react";
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer, Sector } from "recharts";

const COLORS = ["#4caf50", "#ff9800", "#f44336"];

export default function SentimentChart({ chartData }) {
  // chartData: [{sentiment, count}]
  const data = chartData.map(d => ({
    name: d.sentiment.charAt(0).toUpperCase() + d.sentiment.slice(1),
    value: d.count
  }));

  // Custom rendering for 3D-like effect
  const renderActiveShape = (props) => {
    const RADIAN = Math.PI / 180;
    const {
      cx, cy, midAngle, innerRadius, outerRadius, startAngle, endAngle,
      fill, payload, value
    } = props;
    const sin = Math.sin(-RADIAN * midAngle);
    const cos = Math.cos(-RADIAN * midAngle);
    const mx = cx + (outerRadius + 30) * cos;
    const my = cy + (outerRadius + 30) * sin;
    const ex = mx + (cos >= 0 ? 1 : -1) * 22;
    const ey = my;
    const textAnchor = cos >= 0 ? "start" : "end";

    return (
      <g>
        <Sector
          cx={cx}
          cy={cy}
          innerRadius={innerRadius}
          outerRadius={outerRadius + 8}
          startAngle={startAngle}
          endAngle={endAngle}
          fill={fill}
          stroke="#fff"
          strokeWidth={4}
          filter="url(#shadow)"
        />
        <text x={ex} y={ey} textAnchor={textAnchor} fill="#333" fontWeight="bold" fontSize={18}>{payload.name}</text>
        <text x={ex} y={ey + 24} textAnchor={textAnchor} fill="#888" fontSize={16}>{`Count: ${value}`}</text>
      </g>
    );
  };

  const [activeIndex, setActiveIndex] = React.useState(0);
  const onPieEnter = (_, index) => setActiveIndex(index);

  return (
    <ResponsiveContainer width="100%" height={400}>
      <PieChart>
        <defs>
          <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="8" stdDeviation="6" floodColor="#888" floodOpacity="0.25" />
          </filter>
        </defs>
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          cx="50%"
          cy="50%"
          innerRadius={60}
          outerRadius={100}
          fill="#8884d8"
          labelLine={false}
          activeIndex={activeIndex}
          activeShape={renderActiveShape}
          onMouseEnter={onPieEnter}
          stroke="#fff"
          strokeWidth={3}
        >
          {data.map((entry, idx) => (
            <Cell key={`cell-${idx}`} fill={COLORS[idx]} />
          ))}
        </Pie>
        <Tooltip />
        <Legend iconType="circle" wrapperStyle={{ fontSize: 18, fontWeight: 'bold' }} />
      </PieChart>
    </ResponsiveContainer>
  );
} 