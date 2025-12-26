import React from 'react';

const PrizeCard = ({ name, department, isWinner }) => {
  return (
    <div
      className="prize-card rounded-xl flex flex-col items-center justify-center"
      style={{
        position: 'absolute',
        width: '240px',
        height: '320px',
        backgroundColor: '#dc2626',
        border: '3px solid rgba(250, 204, 21, 0.6)',
        boxShadow: isWinner
          ? '0 0 120px rgba(250, 204, 21, 1), 0 0 240px rgba(250, 204, 21, 0.8), inset 0 0 60px rgba(0,0,0,0.3)'
          : '0 0 35px rgba(250, 204, 21, 0.5), 0 0 70px rgba(220, 38, 38, 0.4), inset 0 3px 15px rgba(0,0,0,0.5)',
        transformStyle: 'preserve-3d',
        backfaceVisibility: 'hidden',
        WebkitBackfaceVisibility: 'hidden',
        willChange: 'transform',
        WebkitFontSmoothing: 'antialiased',
        MozOsxFontSmoothing: 'grayscale',
        contain: 'layout paint'
      }}
    >
      {/* 内边框装饰 */}
      <div style={{
        position: 'absolute',
        inset: 0,
        borderRadius: '12px',
        border: '2px solid rgba(250, 163, 4, 0.4)',
        pointerEvents: 'none'
      }}></div>

      {/* 姓名 */}
      <div style={{
        color: '#ffffff',
        fontSize: '38px',
        fontWeight: 'bold',
        marginBottom: '20px',
        textShadow: '0 3px 8px rgba(0,0,0,0.7)',
        transform: 'translateZ(1px)',
        WebkitTransform: 'translateZ(1px)',
        WebkitFontSmoothing: 'antialiased',
        MozOsxFontSmoothing: 'grayscale',
        backfaceVisibility: 'hidden',
        WebkitBackfaceVisibility: 'hidden',
        willChange: 'transform',
        textAlign: 'center',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        maxWidth: '200px'
      }}>
        {name}
      </div>

      {/* 分隔线 */}
      <div style={{
        width: '70px',
        height: '2px',
        background: 'linear-gradient(to right, transparent, rgba(250, 204, 21, 1), transparent)',
        marginBottom: '20px',
        transform: 'translateZ(1px)',
        WebkitTransform: 'translateZ(1px)'
      }}></div>

      {/* 部门 */}
      <div style={{
        color: 'rgba(254, 243, 199, 0.95)',
        fontSize: '20px',
        letterSpacing: '0.05em',
        fontWeight: '500',
        transform: 'translateZ(1px)',
        WebkitTransform: 'translateZ(1px)',
        WebkitFontSmoothing: 'antialiased',
        MozOsxFontSmoothing: 'grayscale',
        textAlign: 'center',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        maxWidth: '200px'
      }}>
        {department}
      </div>

      {/* 中奖状态发光效果 */}
      {isWinner && (
        <div style={{
          position: 'absolute',
          inset: -40,
          borderRadius: '16px',
          background: 'radial-gradient(circle, rgba(250, 204, 21, 0.7) 0%, transparent 70%)',
          animation: 'spotlight 0.8s ease-in-out infinite alternate',
          pointerEvents: 'none',
          backfaceVisibility: 'hidden',
          WebkitBackfaceVisibility: 'hidden'
        }}></div>
      )}
    </div>
  );
};

export default PrizeCard;
