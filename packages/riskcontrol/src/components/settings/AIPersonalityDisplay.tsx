/**
 * AI Personality Display Component
 * 
 * 展示 "AI 调教公示" - 让用户了解每个 AI 功能是如何被配置的
 * 
 * @see .kiro/specs/ai-challenger-personality/design.md
 * @see Requirements 7.1, 7.2, 7.3, 7.4
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, Info } from 'lucide-react';
import { useState } from 'react';
import { getAIFeatureConfigs, type AIFeatureConfig } from '@/services/aiPersonalityConfig';

// ============================================================================
// Main Component
// ============================================================================

/**
 * AI Personality Display
 * 
 * Displays all AI feature configurations in a card-based layout.
 * Shows style, core instructions, and example comparisons.
 */
export function AIPersonalityDisplay() {
  const configs = getAIFeatureConfigs();

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <span className="text-2xl">🤖</span>
        <h2 className="text-xl font-semibold">AI 调教公示</h2>
      </div>
      
      {/* Description */}
      <div className="flex items-start gap-2 p-3 bg-muted/50 rounded-lg">
        <Info className="h-4 w-4 mt-0.5 text-muted-foreground flex-shrink-0" />
        <p className="text-sm text-muted-foreground">
          以下是每个 AI 功能的设计风格和核心指令，让你了解 AI 是如何被"调教"的。
          我们的 AI 被设计为<strong>严厉但负责任的投资教练</strong>，会主动挑战你的假设、
          指出与投资原则的矛盾，而不是一味顺从。
        </p>
      </div>

      {/* Feature Cards */}
      <div className="grid gap-4">
        {configs.map((config) => (
          <AIFeatureCard key={config.id} config={config} />
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// Sub-Components
// ============================================================================

/**
 * Individual AI Feature Card
 */
function AIFeatureCard({ config }: { config: AIFeatureConfig }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Card className="overflow-hidden">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <CardHeader className="pb-2 cursor-pointer hover:bg-muted/30 transition-colors">
            <CardTitle className="flex items-center gap-2 text-base">
              <span className="text-lg">{config.icon}</span>
              <span className="flex-1">{config.name}</span>
              <Badge variant="secondary" className="font-normal">
                {config.style}
              </Badge>
              <ChevronDown 
                className={`h-4 w-4 text-muted-foreground transition-transform ${
                  isOpen ? 'rotate-180' : ''
                }`} 
              />
            </CardTitle>
          </CardHeader>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="space-y-4 pt-0">
            {/* Core Instructions */}
            <div>
              <p className="text-sm font-medium mb-2 text-muted-foreground">核心指令:</p>
              <ul className="text-sm space-y-1.5">
                {config.coreInstructions.map((instruction, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-primary">•</span>
                    <span>{instruction}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Example Comparison */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* Bad Example */}
              <div className="p-3 bg-red-50 dark:bg-red-950/30 rounded-lg border border-red-200 dark:border-red-900">
                <p className="text-xs font-medium text-red-600 dark:text-red-400 mb-1.5 flex items-center gap-1">
                  <span>❌</span> 不好的回答
                </p>
                <p className="text-sm text-red-700 dark:text-red-300">
                  "{config.badExample}"
                </p>
              </div>

              {/* Good Example */}
              <div className="p-3 bg-green-50 dark:bg-green-950/30 rounded-lg border border-green-200 dark:border-green-900">
                <p className="text-xs font-medium text-green-600 dark:text-green-400 mb-1.5 flex items-center gap-1">
                  <span>✅</span> 好的回答
                </p>
                <p className="text-sm text-green-700 dark:text-green-300">
                  "{config.goodExample}"
                </p>
              </div>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

// ============================================================================
// Compact Version
// ============================================================================

/**
 * Compact AI Personality Display
 * 
 * A smaller version for embedding in other pages
 */
export function AIPersonalityDisplayCompact() {
  const configs = getAIFeatureConfigs();

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-sm font-medium">
        <span>🤖</span>
        <span>AI 调教风格</span>
      </div>
      
      <div className="flex flex-wrap gap-2">
        {configs.map((config) => (
          <Badge key={config.id} variant="outline" className="text-xs">
            {config.icon} {config.name.split(' ')[0]}
          </Badge>
        ))}
      </div>
    </div>
  );
}

export default AIPersonalityDisplay;
