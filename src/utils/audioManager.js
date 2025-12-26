/**
 * 音乐管理器
 */
class AudioManager {
  constructor() {
    this.audio = null;
    this.musicUrl = null;
    this.isPlaying = false;
    this.volume = 0.5;
    this.listeners = new Set();
  }

  /**
   * 加载音乐文件
   */
  loadMusic(file) {
    return new Promise((resolve, reject) => {
      try {
        // 释放之前的资源
        if (this.musicUrl) {
          URL.revokeObjectURL(this.musicUrl);
        }

        // 创建新的音频URL
        this.musicUrl = URL.createObjectURL(file);

        // 创建或重置音频对象
        if (!this.audio) {
          this.audio = new Audio();
          this.audio.loop = true;
          this.audio.volume = this.volume;
        } else {
          this.audio.pause();
          this.audio.src = this.musicUrl;
        }

        // 监听加载完成
        this.audio.addEventListener('canplaythrough', () => {
          this.notifyListeners('loaded', { file });
          resolve(this.musicUrl);
        }, { once: true });

        this.audio.addEventListener('error', (e) => {
          reject(new Error('音频加载失败'));
        }, { once: true });

      } catch (e) {
        reject(e);
      }
    });
  }

  /**
   * 播放音乐
   */
  async play(fadeIn = true) {
    if (!this.audio || !this.musicUrl) {
      return false;
    }

    try {
      if (fadeIn) {
        // 淡入效果
        this.audio.volume = 0;
        await this.audio.play();

        const duration = 1000; // 1秒淡入
        const steps = 20;
        const stepDuration = duration / steps;
        const volumeStep = this.volume / steps;

        for (let i = 0; i <= steps; i++) {
          this.audio.volume = Math.min(i * volumeStep, this.volume);
          await new Promise(resolve => setTimeout(resolve, stepDuration));
        }
      } else {
        await this.audio.play();
      }

      this.isPlaying = true;
      this.notifyListeners('play');
      return true;
    } catch (e) {
      console.error('播放失败:', e);
      return false;
    }
  }

  /**
   * 暂停音乐
   */
  pause(fadeOut = true) {
    if (!this.audio || !this.isPlaying) {
      return;
    }

    const doPause = () => {
      this.audio.pause();
      this.isPlaying = false;
      this.notifyListeners('pause');
    };

    if (fadeOut) {
      // 淡出效果
      const duration = 800; // 0.8秒淡出
      const steps = 20;
      const stepDuration = duration / steps;
      const startVolume = this.audio.volume;
      const volumeStep = startVolume / steps;

      let currentStep = 0;
      const fadeOutInterval = setInterval(() => {
        currentStep++;
        this.audio.volume = Math.max(startVolume - currentStep * volumeStep, 0);

        if (currentStep >= steps) {
          clearInterval(fadeOutInterval);
          doPause();
          // 恢复音量设置
          this.audio.volume = this.volume;
        }
      }, stepDuration);
    } else {
      doPause();
    }
  }

  /**
   * 设置音量
   */
  setVolume(volume) {
    this.volume = Math.max(0, Math.min(1, volume));
    if (this.audio) {
      this.audio.volume = this.volume;
    }
    this.notifyListeners('volumeChange', { volume: this.volume });
  }

  /**
   * 获取音量
   */
  getVolume() {
    return this.volume;
  }

  /**
   * 清除音乐
   */
  clearMusic() {
    this.pause(false);
    if (this.musicUrl) {
      URL.revokeObjectURL(this.musicUrl);
      this.musicUrl = null;
    }
    if (this.audio) {
      this.audio.src = '';
    }
    this.notifyListeners('cleared');
  }

  /**
   * 检查是否有音乐
   */
  hasMusic() {
    return !!this.musicUrl;
  }

  /**
   * 添加事件监听
   */
  addListener(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  /**
   * 通知所有监听器
   */
  notifyListeners(event, data) {
    this.listeners.forEach(callback => {
      try {
        callback(event, data);
      } catch (e) {
        console.error('监听器错误:', e);
      }
    });
  }

  /**
   * 销毁
   */
  destroy() {
    this.clearMusic();
    this.listeners.clear();
    this.audio = null;
  }
}

// 导出单例
export const audioManager = new AudioManager();
