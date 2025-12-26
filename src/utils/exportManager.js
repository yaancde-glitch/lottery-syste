/**
 * 导出中奖名单为CSV
 * 注意：如需xlsx格式，需要安装 xlsx 库
 * CSV格式兼容性更好，无需额外依赖
 */

/**
 * 将数据转换为CSV格式
 */
function arrayToCSV(data) {
  if (!data || data.length === 0) {
    return '';
  }

  // CSV BOM for Excel (让Excel正确识别UTF-8)
  const BOM = '\uFEFF';

  // 表头
  const headers = ['序号', '姓名', '部门', '奖项', '中奖时间', '中奖日期'];

  // 数据行
  const rows = data.map((item, index) => {
    return [
      index + 1,
      item.name || '',
      item.department || '',
      item.prizeName || '',
      item.winTimeStr || '',
      item.winDate || ''
    ].map(field => {
      // 如果字段包含逗号、换行或引号，需要用引号包裹并转义
      const str = String(field || '');
      if (str.includes(',') || str.includes('\n') || str.includes('"')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    }).join(',');
  });

  return BOM + [headers.join(','), ...rows].join('\n');
}

/**
 * 导出中奖名单为CSV
 */
export function exportWinnersToCSV(winners, filename = null) {
  if (!winners || winners.length === 0) {
    return false;
  }

  try {
    const csv = arrayToCSV(winners);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });

    // 生成文件名
    const date = new Date().toISOString().split('T')[0];
    const defaultFilename = `中奖名单_${date}.csv`;
    const finalFilename = filename || defaultFilename;

    // 创建下载链接
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = finalFilename;
    link.style.display = 'none';

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // 释放URL
    setTimeout(() => {
      URL.revokeObjectURL(link.href);
    }, 100);

    return true;
  } catch (e) {
    console.error('导出失败:', e);
    return false;
  }
}

/**
 * 使用 xlsx 库导出（如果已安装）
 */
export async function exportWinnersToExcel(winners, filename = null) {
  // 检查是否安装了 xlsx
  try {
    const XLSX = await import('xlsx');

    if (!winners || winners.length === 0) {
      return false;
    }

    // 准备数据
    const data = winners.map((item, index) => ({
      '序号': index + 1,
      '姓名': item.name,
      '部门': item.department,
      '奖项': item.prizeName || '',
      '中奖时间': item.winTimeStr,
      '中奖日期': item.winDate
    }));

    // 创建工作簿
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, '中奖名单');

    // 生成文件名
    const date = new Date().toISOString().split('T')[0];
    const defaultFilename = `中奖名单_${date}.xlsx`;
    const finalFilename = filename || defaultFilename;

    // 导出
    XLSX.writeFile(workbook, finalFilename);
    return true;
  } catch (e) {
    console.log('xlsx未安装，使用CSV导出');
    return exportWinnersToCSV(winners, filename);
  }
}
