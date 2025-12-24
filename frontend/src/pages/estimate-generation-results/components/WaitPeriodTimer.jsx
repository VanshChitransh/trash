import React, { useState, useEffect } from 'react';
import Icon from '../../../components/AppIcon';

const WaitPeriodTimer = ({ waitPeriod, fileName }) => {
  const [remainingTime, setRemainingTime] = useState(waitPeriod.remainingMs);

  useEffect(() => {
    // Update timer every second
    const interval = setInterval(() => {
      setRemainingTime(prev => {
        if (prev <= 1000) {
          clearInterval(interval);
          // Reload page when timer expires
          window.location.reload();
          return 0;
        }
        return prev - 1000;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Calculate hours, minutes, seconds from remaining milliseconds
  const hours = Math.floor(remainingTime / (60 * 60 * 1000));
  const minutes = Math.floor((remainingTime % (60 * 60 * 1000)) / (60 * 1000));
  const seconds = Math.floor((remainingTime % (60 * 1000)) / 1000);

  return (
    <div className="bg-card rounded-lg border border-border p-8">
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-20 h-20 bg-primary/10 rounded-full mb-6">
          <Icon name="Clock" size={40} className="text-primary" />
        </div>
        <h2 className="text-2xl font-semibold text-foreground mb-3">Processing in Progress</h2>
        <p className="text-muted-foreground text-lg">
          Your estimate for <span className="font-medium text-foreground">{fileName}</span> is being processed
        </p>
      </div>

      {/* Timer Display */}
      <div className="bg-gradient-to-r from-primary/5 to-accent/5 rounded-xl p-8 mb-8">
        <div className="text-center mb-4">
          <p className="text-sm text-muted-foreground uppercase tracking-wide mb-4">Time Remaining</p>
          <div className="flex justify-center items-center space-x-4">
            {/* Hours */}
            <div className="flex flex-col items-center">
              <div className="bg-card border-2 border-primary rounded-lg px-6 py-4 min-w-[100px]">
                <div className="text-4xl font-bold text-primary tabular-nums">
                  {String(hours).padStart(2, '0')}
                </div>
              </div>
              <span className="text-xs text-muted-foreground mt-2 uppercase tracking-wide">Hours</span>
            </div>

            <div className="text-3xl font-bold text-muted-foreground">:</div>

            {/* Minutes */}
            <div className="flex flex-col items-center">
              <div className="bg-card border-2 border-primary rounded-lg px-6 py-4 min-w-[100px]">
                <div className="text-4xl font-bold text-primary tabular-nums">
                  {String(minutes).padStart(2, '0')}
                </div>
              </div>
              <span className="text-xs text-muted-foreground mt-2 uppercase tracking-wide">Minutes</span>
            </div>

            <div className="text-3xl font-bold text-muted-foreground">:</div>

            {/* Seconds */}
            <div className="flex flex-col items-center">
              <div className="bg-card border-2 border-primary rounded-lg px-6 py-4 min-w-[100px]">
                <div className="text-4xl font-bold text-primary tabular-nums">
                  {String(seconds).padStart(2, '0')}
                </div>
              </div>
              <span className="text-xs text-muted-foreground mt-2 uppercase tracking-wide">Seconds</span>
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mt-6">
          <div className="w-full bg-muted rounded-full h-3">
            <div 
              className="bg-gradient-to-r from-primary to-accent h-3 rounded-full transition-all duration-1000"
              style={{ 
                width: `${100 - (remainingTime / waitPeriod.remainingMs) * 100}%` 
              }}
            ></div>
          </div>
        </div>
      </div>

      {/* Information Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="bg-muted/50 rounded-lg p-4">
          <div className="flex items-start space-x-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Icon name="FileText" size={20} className="text-primary" />
            </div>
            <div>
              <h4 className="font-medium text-foreground mb-1">Current File</h4>
              <p className="text-sm text-muted-foreground">{fileName}</p>
            </div>
          </div>
        </div>

        <div className="bg-muted/50 rounded-lg p-4">
          <div className="flex items-start space-x-3">
            <div className="p-2 bg-accent/10 rounded-lg">
              <Icon name="Calendar" size={20} className="text-accent" />
            </div>
            <div>
              <h4 className="font-medium text-foreground mb-1">Available At</h4>
              <p className="text-sm text-muted-foreground">
                {new Date(waitPeriod.canGenerateAt).toLocaleString()}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Info Message */}
      <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <div className="flex items-start space-x-3">
          <Icon name="Info" size={20} className="text-blue-600 dark:text-blue-400 mt-0.5" />
          <div className="flex-1">
            <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-1">Why the wait?</h4>
            <p className="text-sm text-blue-700 dark:text-blue-300">
              We ensure high-quality estimates by thoroughly analyzing your inspection report. 
              This process takes time to provide you with the most accurate cost breakdown. 
              You can navigate away from this page and return later - your estimate will be ready when the timer completes.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WaitPeriodTimer;

