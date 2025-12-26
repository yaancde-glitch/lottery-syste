import React, { useEffect, useRef, useMemo } from 'react';
import PrizeCard from './PrizeCard';
import { getOriginalId } from '../utils/dataManager';

const CylinderLayout = ({ prizes, winnerIds, isSpinning }) => {
  // 3D 环幕参数 - 使用useMemo缓存计算结果
  const ROWS = 6;
  const COLS = 30;
  const RADIUS = 3200;
  const ARC_DEGREES = 260;
  const CARD_WIDTH = 240;
  const CARD_HEIGHT = 320;
  const TOTAL_WIDTH = 8000;

  const rowYOffsets = [-850, -510, -170, 170, 510, 850];
  const rowSpeedFactors = [0.7, 0.85, 0.95, 1.05, 1.15, 1.3];

  // 动画状态 - 完全使用ref，不触发重渲染
  const slideOffsetRef = useRef(0);
  const animationRef = useRef(null);
  const lastTimeRef = useRef(0);

  // 将卡片分组为 6 行 - 使用useMemo确保只计算一次
  // 关键修复：永远只从 prizes 中取固定数量的卡片，确保 DOM 数量恒定
  const rows = React.useMemo(() => {
    const result = [];
    const cloneCount = 10;

    // 如果 prizes 为空，返回空数组避免除以零错误
    if (!prizes || prizes.length === 0) {
      return result;
    }

    for (let rowIndex = 0; rowIndex < ROWS; rowIndex++) {
      const startIndex = rowIndex * COLS;

      // 关键：使用模运算循环取数据，确保永远只取 COLS 个基础卡片
      // 这样无论 prizes 有多少元素，每行永远只有 COLS + 2*cloneCount 个 DOM
      let rowCards = [];
      for (let colIndex = 0; colIndex < COLS; colIndex++) {
        const globalIndex = (startIndex + colIndex) % prizes.length;
        rowCards.push(prizes[globalIndex]);
      }

      // 添加克隆用于无缝滚动
      const headClones = rowCards.slice(-cloneCount);
      const tailClones = rowCards.slice(0, cloneCount);
      rowCards = [...headClones, ...rowCards, ...tailClones];

      result.push({
        rowIndex,
        cards: rowCards,
        yOffset: rowYOffsets[rowIndex],
        speedFactor: rowSpeedFactors[rowIndex]
      });
    }
    return result;
  }, [prizes]);

  const anglePerCard = ARC_DEGREES / (COLS - 1);

  // 使用 ref 存储最新值，避免动画循环闭包陷阱
  const rowsRef = useRef(rows);
  useEffect(() => {
    rowsRef.current = rows;
  }, [rows]);

  // DOM 缓存 ref - 当 rows 变化时需要清除
  const wrappersCacheRef = useRef(null);

  // 当 rows 变化时，清除 DOM 缓存（因为 DOM 重新渲染了）
  useEffect(() => {
    wrappersCacheRef.current = null;
  }, [rows]);

  // 动画循环 - 完全独立于React渲染
  useEffect(() => {
    // 清除旧的 DOM 缓存，确保使用最新的 DOM 元素
    wrappersCacheRef.current = null;

    const getCachedWrappers = () => {
      if (!wrappersCacheRef.current) {
        wrappersCacheRef.current = document.querySelectorAll('.card-wrapper');
      }
      return wrappersCacheRef.current;
    };

    const animate = (timestamp) => {
      if (!lastTimeRef.current) {
        lastTimeRef.current = timestamp;
      }

      const deltaTime = timestamp - lastTimeRef.current;
      lastTimeRef.current = timestamp;

      // 抽奖时速度提升 12 倍
      const speedMultiplier = isSpinning ? 12 : 1;
      const baseSpeed = 1.2;

      // 直接更新ref值，不触发任何React状态变化
      slideOffsetRef.current = (slideOffsetRef.current + baseSpeed * speedMultiplier * (deltaTime / 16)) % TOTAL_WIDTH;

      const currentOffset = slideOffsetRef.current;

      // 直接操作DOM样式 - 最高性能
      const wrappers = getCachedWrappers();

      // 使用for循环代替forEach，性能更好
      for (let i = 0; i < wrappers.length; i++) {
        const wrapper = wrappers[i];
        if (wrapper && wrapper.dataset) {
          const { rowIndex, colIndex } = wrapper.dataset;

          const currentRows = rowsRef.current;
          const row = currentRows[Number(rowIndex)];
          if (row) {
            const direction = row.rowIndex % 2 === 0 ? 1 : -1;
            const rowOffset = currentOffset * row.speedFactor * direction;

            const adjustedColIndex = Number(colIndex) >= 10 ? Number(colIndex) - 10 : Number(colIndex) + COLS - 10;
            const rotateY = -ARC_DEGREES / 2 + (adjustedColIndex * anglePerCard);
            const slideAngle = (rowOffset / TOTAL_WIDTH) * ARC_DEGREES;
            const actualRotateY = rotateY + slideAngle;

            wrapper.style.transform = `rotateY(${actualRotateY}deg) translateY(${row.yOffset}px) translateZ(${-RADIUS}px)`;
            wrapper.style.zIndex = '1';
          }
        }
      }

      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      // 清理缓存的DOM引用
      wrappersCacheRef.current = null;
    };
  }, [isSpinning]); // 只在这个值变化时重新创建动画循环

  return (
    <div className="cylinder-stage">
      {rows.map((row) => (
        <div key={row.rowIndex} className="cylinder-row">
          {row.cards.map((prize, colIndex) => {
            return (
              <div
                key={`${row.rowIndex}-${colIndex}-${prize.id}`}
                className="card-wrapper"
                data-row-index={row.rowIndex}
                data-col-index={colIndex}
                data-prize-id={prize.id}
                style={{
                  position: 'absolute',
                  left: '50%',
                  top: '50%',
                  width: `${CARD_WIDTH}px`,
                  height: `${CARD_HEIGHT}px`,
                  marginLeft: `-${CARD_WIDTH / 2}px`,
                  marginTop: `-${CARD_HEIGHT / 2}px`,
                  transformStyle: 'preserve-3d',
                  backfaceVisibility: 'hidden',
                  WebkitBackfaceVisibility: 'hidden',
                  zIndex: 1,
                  // 层级优化 - 告诉浏览器这个元素的变化不会影响外部
                  contain: 'layout paint'
                }}
              >
                <PrizeCard
                  name={prize.name}
                  department={prize.department}
                  isWinner={winnerIds?.has?.(getOriginalId(prize.id)) || false}
                />
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
};

export default CylinderLayout;
