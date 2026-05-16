/*
 * Copyright (c) 2025 Bytedance, Inc. and its affiliates.
 * SPDX-License-Identifier: Apache-2.0
 */

import { ConsoleLogger } from '@tarko/mcp-agent';
import { BrowserControlMode } from '../../../types';
import { ModelProviderName } from '@tarko/agent';

/**
 * Built-in providers known to ship with vision/grounding capability.
 * Additional providers can be enabled by:
 *   - setting env var TARKO_GUI_ALLOW_ALL=1 (allow any provider), or
 *   - listing comma-separated names in TARKO_GUI_EXTRA_PROVIDERS, e.g.
 *     TARKO_GUI_EXTRA_PROVIDERS=openai-compatible,openai
 */
const GUI_SUPPORTED_PROVIDERS: ModelProviderName[] = ['volcengine'];

function getEffectiveAllowList(): {
  allowAll: boolean;
  providers: Set<string>;
} {
  const allowAll = process.env.TARKO_GUI_ALLOW_ALL === '1';
  const extra = (process.env.TARKO_GUI_EXTRA_PROVIDERS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return {
    allowAll,
    providers: new Set([...GUI_SUPPORTED_PROVIDERS, ...extra]),
  };
}

/**
 * Validates the browser control mode based on model provider capabilities
 *
 * @param provider - The model provider name
 * @param requestedMode - The requested browser control mode
 * @param logger - Logger instance for user feedback
 * @returns The validated browser control mode (may be changed if unsupported)
 */
export function validateBrowserControlMode(
  provider: ModelProviderName | string | undefined,
  requestedMode: BrowserControlMode | undefined,
  logger: ConsoleLogger,
): BrowserControlMode {
  // Default to mixed mode if not specified
  const defaultMode: BrowserControlMode = 'hybrid';
  const requestedModeValue = requestedMode || defaultMode;

  // Early return if mode is already browser-use-only
  if (requestedModeValue === 'dom') {
    return requestedModeValue;
  }

  const { allowAll, providers } = getEffectiveAllowList();
  const providerOk = !!provider && (allowAll || providers.has(String(provider)));

  if (!providerOk) {
    const providerName = provider ? provider : 'Unknown';
    logger.warn(
      `Vision-based browser control (${requestedModeValue}) is not supported with ${providerName}`,
    );
    logger.info(
      'Vision-based browser control ("hybrid" / "visual-grounding") requires a vision-capable ' +
        'provider. Built-in: Volcengine (Doubao 1.5 VL). Set TARKO_GUI_ALLOW_ALL=1 to bypass ' +
        'this gate, or TARKO_GUI_EXTRA_PROVIDERS=name1,name2 to allow additional providers. ' +
        'Switching to "dom" mode.',
    );
    return 'dom';
  }

  return requestedModeValue;
}
