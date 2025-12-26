import React from 'react';

const Header = ({ mainTitle, subTitle, onOpenSettings, onToggleMusic, isPlaying, hasMusic }) => {
  return (
    <div className="fixed top-0 left-0 right-0 z-50 flex flex-col items-center justify-center pt-12 md:pt-16">
      {/* 右上角按钮组 */}
      <div className="absolute top-6 right-6 flex flex-col gap-3">
        {/* 音乐控制按钮 */}
        <button
          onClick={onToggleMusic}
          className={`text-gray-400 hover:text-yellow-400 transition-colors ${isPlaying ? 'text-yellow-400' : ''}`}
          title={isPlaying ? '暂停音乐' : '播放音乐'}
        >
          {isPlaying ? (
            // 暂停图标
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-7 w-7"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
              />
            </svg>
          ) : (
            // 播放图标
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-7 w-7"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
              />
            </svg>
          )}
        </button>

        {/* 设置按钮 */}
        <button
          onClick={onOpenSettings}
          className="text-gray-400 hover:text-yellow-400 transition-colors"
          title="打开设置"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-8 w-8"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
        </button>
      </div>

      {/* 标题区域 - 增加垂直间距 */}
      <div className="flex flex-col items-center gap-6 text-center">
        {/* 主标题 - 超大、超粗、字间距 */}
        <h1 className="text-5xl md:text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 via-yellow-500 to-yellow-300 drop-shadow-xl tracking-widest">
          {mainTitle}
        </h1>

        {/* 金色分割线 - 装饰元素 */}
        <div className="h-[1px] w-32 bg-gradient-to-r from-transparent via-yellow-500 to-transparent" />

        {/* 副标题 - 较小、较细、夸张字间距、半透明 */}
        <h2 className="text-2xl md:text-3xl font-light text-yellow-200/80 drop-shadow-lg tracking-[0.5em]">
          {subTitle}
        </h2>
      </div>
    </div>
  );
};

export default Header;
