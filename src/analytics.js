// FitPulse AI - Interactive Analytics & Data Visualizer
// Native Canvas-based high-DPI cyber charts with zero external dependencies

export class AnalyticsRenderer {
  constructor(canvasElement) {
    this.canvas = canvasElement;
    this.ctx = canvasElement.getContext('2d');
  }

  /**
   * Render a sleek glowing bar chart of the past 7 days' calories burned
   */
  renderWeeklyCalories(daysData) {
    const canvas = this.canvas;
    const ctx = this.ctx;
    const dpr = window.devicePixelRatio || 1;

    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const w = rect.width;
    const h = rect.height;

    ctx.clearRect(0, 0, w, h);

    if (!daysData || daysData.length === 0) return;

    const maxVal = Math.max(100, ...daysData.map(d => d.calories));
    const paddingBottom = 28;
    const paddingTop = 20;
    const chartHeight = h - paddingBottom - paddingTop;
    const barWidth = Math.min(36, (w / daysData.length) * 0.48);
    const spacing = w / daysData.length;

    // Draw horizontal grid lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
    ctx.lineWidth = 1;
    for (let step = 0; step <= 3; step++) {
      const y = paddingTop + (chartHeight * step) / 3;
      ctx.beginPath();
      ctx.moveTo(10, y);
      ctx.lineTo(w - 10, y);
      ctx.stroke();

      const labelVal = Math.round(maxVal - (maxVal * step) / 3);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
      ctx.font = '10px system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`${labelVal} kcal`, 12, y - 4);
    }

    // Draw bars
    daysData.forEach((item, idx) => {
      const x = idx * spacing + (spacing - barWidth) / 2;
      const barH = (item.calories / maxVal) * chartHeight;
      const y = h - paddingBottom - barH;

      // Bar gradient (Neon Emerald to Cyan)
      const grad = ctx.createLinearGradient(0, y, 0, y + barH);
      grad.addColorStop(0, '#00F5A0');
      grad.addColorStop(1, 'rgba(0, 217, 245, 0.3)');

      ctx.save();
      ctx.fillStyle = grad;
      ctx.shadowColor = '#00F5A0';
      ctx.shadowBlur = item.calories > 0 ? 10 : 0;

      ctx.beginPath();
      ctx.roundRect(x, y, barWidth, Math.max(4, barH), 6);
      ctx.fill();
      ctx.restore();

      // Top value label
      if (item.calories > 0) {
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 10px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`${item.calories}`, x + barWidth / 2, y - 6);
      }

      // Day name label at bottom
      ctx.fillStyle = idx === daysData.length - 1 ? '#00F5A0' : 'rgba(255, 255, 255, 0.6)';
      ctx.font = '11px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(item.dayName, x + barWidth / 2, h - 8);
    });
  }

  /**
   * Render exercise distribution doughnut chart
   */
  renderExerciseDistribution(exerciseCounts) {
    const canvas = this.canvas;
    const ctx = this.ctx;
    const dpr = window.devicePixelRatio || 1;

    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const w = rect.width;
    const h = rect.height;
    ctx.clearRect(0, 0, w, h);

    const entries = Object.entries(exerciseCounts || {}).filter(([_, count]) => count > 0);
    const total = entries.reduce((acc, [_, count]) => acc + count, 0);

    const centerX = w * 0.38;
    const centerY = h * 0.5;
    const radius = Math.min(centerX - 15, centerY - 15);
    const innerRadius = radius * 0.62;

    if (total === 0) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.font = '13px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('No workout data yet', w / 2, h / 2);
      return;
    }

    const COLORS = ['#00F5A0', '#00D9F5', '#FFB800', '#FF4B72', '#B55FE6', '#4E88FF'];
    let startAngle = -Math.PI / 2;

    entries.forEach(([exerciseId, count], idx) => {
      const sliceAngle = (count / total) * Math.PI * 2;
      const endAngle = startAngle + sliceAngle;
      const color = COLORS[idx % COLORS.length];

      ctx.save();
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, startAngle, endAngle);
      ctx.arc(centerX, centerY, innerRadius, endAngle, startAngle, true);
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = 8;
      ctx.fill();
      ctx.restore();

      startAngle = endAngle;
    });

    // Center total text
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 16px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${total}`, centerX, centerY - 8);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.font = '10px system-ui, sans-serif';
    ctx.fillText('TOTAL REPS', centerX, centerY + 12);

    // Legend on the right side
    const legendX = w * 0.66;
    let legendY = 24;

    entries.slice(0, 5).forEach(([exerciseId, count], idx) => {
      const color = COLORS[idx % COLORS.length];
      const pct = Math.round((count / total) * 100);

      // Color dot
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(legendX, legendY, 5, 0, Math.PI * 2);
      ctx.fill();

      // Text label
      ctx.fillStyle = '#E5E7EB';
      ctx.font = '11px system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      const cleanName = exerciseId.replace('-', ' ').toUpperCase();
      ctx.fillText(`${cleanName} (${pct}%)`, legendX + 12, legendY);

      legendY += 22;
    });
  }
}
