/*
 * Copyright (c) 2025 Bytedance, Inc. and its affiliates.
 * SPDX-License-Identifier: Apache-2.0
 */
import * as puppeteer from 'puppeteer-core';
import { BaseBrowser, BaseBrowserOptions } from './base-browser';
import { LaunchOptions } from './types';

/**
 * Configuration options for RemoteBrowser
 * @extends BaseBrowserOptions
 * @interface RemoteBrowserOptions
 * @property {string} [wsEndpoint] - WebSocket endpoint URL for direct connection
 * @property {string} [cdpEndpoint] - Remote Chrome DevTools Protocol endpoint
 */
export interface RemoteBrowserOptions extends BaseBrowserOptions {
  wsEndpoint?: string;
  /** @default http://localhost:9222/json/version */
  cdpEndpoint?: string;
}

/**
 * RemoteBrowser class for connecting to remote browser instances
 *
 * Currently, this RemoteBrowser is not production ready,
 * mainly because it still relies on `puppeteer-core`,
 * which can only run on Node.js.
 *
 * At the same time, Chrome instances built with
 * `--remote-debugging-address` on Linux have security risks
 *
 * @see https://issues.chromium.org/issues/41487252
 * @see https://issues.chromium.org/issues/40261787
 * @see https://github.com/pyppeteer/pyppeteer/pull/379
 * @see https://stackoverflow.com/questions/72760355/chrome-remote-debugging-not-working-computer-to-computer
 *
 * @extends BaseBrowser
 */
export class RemoteBrowser extends BaseBrowser {
  /**
   * Creates a new RemoteBrowser instance
   * @param {RemoteBrowserOptions} [options] - Configuration options for remote browser connection
   */
  constructor(private options?: RemoteBrowserOptions) {
    super(options);
  }

  /**
   * Connects to a remote browser instance using WebSocket
   * If no WebSocket endpoint is provided, attempts to discover it using the DevTools Protocol
   * @param {LaunchOptions} [options] - Launch configuration options
   * @returns {Promise<void>} Promise that resolves when connected to the remote browser
   * @throws {Error} If connection to the remote browser fails
   */
  async launch(options?: LaunchOptions): Promise<void> {
    this.logger.info('Browser Launch options:', options);

    let browserWSEndpoint = this.options?.wsEndpoint;

    if (!browserWSEndpoint) {
      // Accept either a bare CDP base (http://host:9222) or a full discovery
      // URL (http://host:9222/json/version). Normalise to the discovery URL.
      const raw = this.options?.cdpEndpoint || 'http://127.0.0.1:9222';
      const cdpEndpoint = /\/json(\/version)?\/?$/.test(raw)
        ? raw
        : `${raw.replace(/\/$/, '')}/json/version`;
      const response = await fetch(cdpEndpoint);
      if (!response.ok) {
        throw new Error(
          `CDP discovery request failed (${response.status} ${response.statusText}) at ${cdpEndpoint}`,
        );
      }
      const body = await response.text();
      let discovery: { webSocketDebuggerUrl?: string };
      try {
        discovery = JSON.parse(body);
      } catch (parseErr) {
        throw new Error(
          `CDP discovery response was not JSON (got ${body.length} bytes) at ${cdpEndpoint}: ${(parseErr as Error).message}`,
        );
      }
      if (!discovery.webSocketDebuggerUrl) {
        throw new Error(`CDP discovery missing webSocketDebuggerUrl at ${cdpEndpoint}`);
      }
      browserWSEndpoint = discovery.webSocketDebuggerUrl;
    }

    this.logger.info('Using WebSocket endpoint:', browserWSEndpoint);

    const puppeteerConnectOptions: puppeteer.ConnectOptions = {
      browserWSEndpoint,
      defaultViewport: options?.defaultViewport ?? { width: 1280, height: 800 },
    };

    try {
      this.browser = await puppeteer.connect(puppeteerConnectOptions);
      await this.setupPageListener();
      this.logger.success('Connected to remote browser successfully');
    } catch (error) {
      this.logger.error('Failed to connect to remote browser:', error);
      throw error;
    }
  }

  async setupPageListener() {
    super.setupPageListener();
  }

  /**
   * Disconnect from the upstream browser instead of closing it.
   * The remote browser is owned by something else (CDP server) — calling
   * browser.close() on an attached puppeteer connection terminates the
   * upstream chromium process, which is destructive for our use case.
   */
  async close(): Promise<void> {
    this.logger.info('Disconnecting from remote browser (leaving upstream alive)');
    try {
      await this.browser?.disconnect();
      this.browser = null;
      this.logger.success('Disconnected from remote browser');
    } catch (error) {
      this.logger.error('Failed to disconnect from remote browser:', error);
      throw error;
    }
  }
}
