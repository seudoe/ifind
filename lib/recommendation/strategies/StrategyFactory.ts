/**
 * Recommendation Strategy Factory
 * 
 * Centralized factory for creating and managing recommendation strategies.
 * Provides strategy selection logic and configuration.
 */

import { BruteForceStrategy } from "./BruteForceStrategy";
import { HNSWStrategy } from "./HNSWStrategy";
import type { RecommendationStrategy } from "./types";
import { StrategyType } from "./types";

/**
 * Configuration for strategy selection
 */
export interface StrategyConfig {
  /** Strategy type to use */
  type: StrategyType;
  /** Optional strategy-specific parameters */
  params?: Record<string, unknown>;
}

/**
 * Default strategy configuration
 * Uses HNSW for scalable performance, with brute-force as fallback
 */
const DEFAULT_STRATEGY_CONFIG: StrategyConfig = {
  type: StrategyType.HNSW,
};

/**
 * Strategy Factory
 * 
 * Responsible for creating and configuring recommendation strategies
 * based on configuration or environment settings.
 */
export class StrategyFactory {
  private static instance: StrategyFactory | null = null;
  private activeStrategy: RecommendationStrategy | null = null;
  private config: StrategyConfig;

  private constructor(config?: StrategyConfig) {
    this.config = config || this.getConfigFromEnvironment();
  }

  /**
   * Get singleton instance of the factory
   */
  static getInstance(config?: StrategyConfig): StrategyFactory {
    if (!StrategyFactory.instance) {
      StrategyFactory.instance = new StrategyFactory(config);
    }
    return StrategyFactory.instance;
  }

  /**
   * Reset the singleton (useful for testing)
   */
  static reset(): void {
    StrategyFactory.instance = null;
  }

  /**
   * Get strategy configuration from environment variables
   */
  private getConfigFromEnvironment(): StrategyConfig {
    const strategyType = process.env.RECOMMENDATION_STRATEGY;

    switch (strategyType?.toLowerCase()) {
      case "hnsw":
        return { type: StrategyType.HNSW };
      case "brute-force":
      case "bruteforce":
        return { type: StrategyType.BRUTE_FORCE };
      default:
        console.log(
          `[StrategyFactory] Using default strategy: ${DEFAULT_STRATEGY_CONFIG.type}`
        );
        return DEFAULT_STRATEGY_CONFIG;
    }
  }

  /**
   * Create a strategy instance based on type
   */
  private createStrategy(type: StrategyType): RecommendationStrategy {
    switch (type) {
      case StrategyType.BRUTE_FORCE:
        return new BruteForceStrategy();
      case StrategyType.HNSW:
        return new HNSWStrategy();
      default:
        console.warn(
          `[StrategyFactory] Unknown strategy type: ${type}. Falling back to brute-force.`
        );
        return new BruteForceStrategy();
    }
  }

  /**
   * Get the active recommendation strategy
   * Creates and initializes the strategy if not already active
   */
  async getStrategy(): Promise<RecommendationStrategy> {
    if (!this.activeStrategy) {
      console.log(`[StrategyFactory] Creating strategy: ${this.config.type}`);
      this.activeStrategy = this.createStrategy(this.config.type);

      // Initialize strategy if it has an initialize method
      if (this.activeStrategy.initialize) {
        try {
          await this.activeStrategy.initialize();
        } catch (error) {
          console.error(
            `[StrategyFactory] Failed to initialize strategy ${this.activeStrategy.name}:`,
            error
          );
          // Fall back to brute-force on initialization failure
          if (this.activeStrategy.name !== "brute-force") {
            console.warn("[StrategyFactory] Falling back to brute-force strategy due to initialization error");
            this.activeStrategy = new BruteForceStrategy();
            await this.activeStrategy.initialize?.();
          } else {
            throw error;
          }
        }
      }

      console.log(`[StrategyFactory] Active strategy: ${this.activeStrategy.name}`);
    }

    return this.activeStrategy;
  }

  /**
   * Get current strategy configuration
   */
  getConfig(): StrategyConfig {
    return { ...this.config };
  }

  /**
   * Update strategy configuration and reset active strategy
   * The new strategy will be created on next getStrategy() call
   */
  async setConfig(config: StrategyConfig): Promise<void> {
    // Dispose of old strategy if exists
    if (this.activeStrategy?.dispose) {
      await this.activeStrategy.dispose();
    }

    this.config = config;
    this.activeStrategy = null;
    console.log(`[StrategyFactory] Strategy configuration updated to: ${config.type}`);
  }

  /**
   * Clean up resources
   */
  async dispose(): Promise<void> {
    if (this.activeStrategy?.dispose) {
      await this.activeStrategy.dispose();
    }
    this.activeStrategy = null;
  }
}

/**
 * Convenience function to get the default strategy instance
 */
export async function getDefaultStrategy(): Promise<RecommendationStrategy> {
  const factory = StrategyFactory.getInstance();
  return factory.getStrategy();
}
