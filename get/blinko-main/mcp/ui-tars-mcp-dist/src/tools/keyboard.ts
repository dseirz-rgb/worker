// Keyboard Tools - Type text, press keys, hotkey functionality
import { keyboard, Key } from '@nut-tree-fork/nut-js';
import { ToolDefinition, ToolResult, TypeTextParams, HotkeyParams, ErrorCode } from '../types/index.js';
import { createError } from '../utils/errors.js';
import { getLogger } from '../utils/logger.js';

/**
 * Map modifier string to nut-js Key
 */
function getModifierKey(modifier: string): Key {
  switch (modifier.toLowerCase()) {
    case 'ctrl':
    case 'control':
      return Key.LeftControl;
    case 'alt':
      return Key.LeftAlt;
    case 'shift':
      return Key.LeftShift;
    case 'meta':
    case 'win':
    case 'cmd':
      return Key.LeftSuper;
    default:
      throw new Error(`Unknown modifier: ${modifier}`);
  }
}

/**
 * Map key string to nut-js Key
 */
function getKey(keyName: string): Key {
  // Handle single character keys
  if (keyName.length === 1) {
    const char = keyName.toUpperCase();
    if (char >= 'A' && char <= 'Z') {
      return Key[char as keyof typeof Key] as Key;
    }
    if (char >= '0' && char <= '9') {
      return Key[`Num${char}` as keyof typeof Key] as Key;
    }
  }

  // Handle special keys
  const keyMap: Record<string, Key> = {
    'enter': Key.Enter,
    'return': Key.Enter,
    'tab': Key.Tab,
    'escape': Key.Escape,
    'esc': Key.Escape,
    'backspace': Key.Backspace,
    'delete': Key.Delete,
    'space': Key.Space,
    'up': Key.Up,
    'down': Key.Down,
    'left': Key.Left,
    'right': Key.Right,
    'home': Key.Home,
    'end': Key.End,
    'pageup': Key.PageUp,
    'pagedown': Key.PageDown,
    'f1': Key.F1,
    'f2': Key.F2,
    'f3': Key.F3,
    'f4': Key.F4,
    'f5': Key.F5,
    'f6': Key.F6,
    'f7': Key.F7,
    'f8': Key.F8,
    'f9': Key.F9,
    'f10': Key.F10,
    'f11': Key.F11,
    'f12': Key.F12,
  };

  const key = keyMap[keyName.toLowerCase()];
  if (key) {
    return key;
  }

  throw new Error(`Unknown key: ${keyName}`);
}

/**
 * Type text at current cursor position
 */
async function typeText(params: TypeTextParams): Promise<ToolResult> {
  const logger = getLogger();
  const { text, delay } = params;

  try {
    if (!text) {
      return {
        success: false,
        error: createError(ErrorCode.KEYBOARD_ERROR, 'Text cannot be empty'),
      };
    }

    // Set typing delay if specified
    if (delay && delay > 0) {
      keyboard.config.autoDelayMs = delay;
    }

    await keyboard.type(text);

    logger.debug(`Typed text: "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}"`);

    return {
      success: true,
      data: { text, length: text.length, action: 'type_text' },
    };
  } catch (error) {
    logger.error(`Type text failed: ${error}`);
    return {
      success: false,
      error: createError(
        ErrorCode.KEYBOARD_ERROR,
        `Type text failed: ${error instanceof Error ? error.message : String(error)}`
      ),
    };
  }
}

/**
 * Press a single key
 */
async function pressKey(params: { key: string }): Promise<ToolResult> {
  const logger = getLogger();
  const { key: keyName } = params;

  try {
    const key = getKey(keyName);
    await keyboard.pressKey(key);
    await keyboard.releaseKey(key);

    logger.debug(`Pressed key: ${keyName}`);

    return {
      success: true,
      data: { key: keyName, action: 'press_key' },
    };
  } catch (error) {
    logger.error(`Press key failed: ${error}`);
    return {
      success: false,
      error: createError(
        ErrorCode.KEYBOARD_ERROR,
        `Press key failed: ${error instanceof Error ? error.message : String(error)}`
      ),
    };
  }
}

/**
 * Execute a keyboard shortcut (hotkey)
 */
async function hotkey(params: HotkeyParams): Promise<ToolResult> {
  const logger = getLogger();
  const { modifiers, key: keyName } = params;

  try {
    // Validate modifiers
    const validModifiers = ['ctrl', 'control', 'alt', 'shift', 'meta', 'win', 'cmd'];
    for (const mod of modifiers) {
      if (!validModifiers.includes(mod.toLowerCase())) {
        return {
          success: false,
          error: createError(
            ErrorCode.KEYBOARD_ERROR,
            `Invalid modifier: ${mod}. Valid modifiers: ${validModifiers.join(', ')}`
          ),
        };
      }
    }

    // Get modifier keys
    const modifierKeys = modifiers.map(getModifierKey);
    const mainKey = getKey(keyName);

    // Press modifiers
    for (const modKey of modifierKeys) {
      await keyboard.pressKey(modKey);
    }

    // Press and release main key
    await keyboard.pressKey(mainKey);
    await keyboard.releaseKey(mainKey);

    // Release modifiers in reverse order
    for (const modKey of modifierKeys.reverse()) {
      await keyboard.releaseKey(modKey);
    }

    logger.debug(`Hotkey: ${modifiers.join('+')}+${keyName}`);

    return {
      success: true,
      data: { modifiers, key: keyName, action: 'hotkey' },
    };
  } catch (error) {
    logger.error(`Hotkey failed: ${error}`);
    return {
      success: false,
      error: createError(
        ErrorCode.KEYBOARD_ERROR,
        `Hotkey failed: ${error instanceof Error ? error.message : String(error)}`
      ),
    };
  }
}

// Tool definitions
export const typeTextTool: ToolDefinition = {
  name: 'type_text',
  description: 'Type text at current cursor position',
  inputSchema: {
    type: 'object',
    properties: {
      text: { type: 'string', description: 'Text to type' },
      delay: { type: 'number', description: 'Delay between keystrokes in ms' },
    },
    required: ['text'],
  },
  handler: async (params: unknown) => typeText(params as TypeTextParams),
};

export const pressKeyTool: ToolDefinition = {
  name: 'press_key',
  description: 'Press a single key (Enter, Tab, Escape, F1-F12, etc.)',
  inputSchema: {
    type: 'object',
    properties: {
      key: {
        type: 'string',
        description: 'Key to press (e.g., Enter, Tab, Escape, F1, a, 1)',
      },
    },
    required: ['key'],
  },
  handler: async (params: unknown) => pressKey(params as { key: string }),
};

export const hotkeyTool: ToolDefinition = {
  name: 'hotkey',
  description: 'Execute a keyboard shortcut (e.g., Ctrl+C, Alt+Tab)',
  inputSchema: {
    type: 'object',
    properties: {
      modifiers: {
        type: 'array',
        items: {
          type: 'string',
          enum: ['ctrl', 'alt', 'shift', 'meta'],
        },
        description: 'Modifier keys (ctrl, alt, shift, meta)',
      },
      key: { type: 'string', description: 'Main key to press' },
    },
    required: ['modifiers', 'key'],
  },
  handler: async (params: unknown) => hotkey(params as HotkeyParams),
};

// Export all keyboard tools
export const keyboardTools: ToolDefinition[] = [typeTextTool, pressKeyTool, hotkeyTool];

// Export functions for testing
export { typeText, pressKey, hotkey };
