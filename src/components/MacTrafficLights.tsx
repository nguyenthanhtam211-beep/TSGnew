import React from 'react';

interface MacTrafficLightsProps {
  onClose?: () => void;
  onMinimize?: () => void;
  onMaximize?: () => void;
  isMaximized?: boolean;
  className?: string;
  disabledMinimize?: boolean;
}

/**
 * Clean Modern Architecture:
 * Replaced faux macOS Sequoia traffic dots with null.
 * Modal windows now feature a single high-efficiency Linear/Stripe style close button [✕] in the header.
 */
export default function MacTrafficLights(_props: MacTrafficLightsProps) {
  return null;
}