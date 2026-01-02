// UE5 Blueprint and Material Node Tools
// Provides tools for manipulating blueprint graphs and material editor nodes
import { ToolDefinition, ToolResult, ErrorCode } from '../../types/index.js';
import { createError } from '../../utils/errors.js';
import { getLogger } from '../../utils/logger.js';

// Common material expression types for reference
const MATERIAL_EXPRESSIONS = [
  'TextureSample', 'TextureCoordinate', 'Constant', 'Constant2Vector',
  'Constant3Vector', 'Constant4Vector', 'Multiply', 'Add', 'Subtract',
  'Divide', 'Lerp', 'Power', 'Clamp', 'Saturate', 'OneMinus', 'Abs',
  'Fresnel', 'Normalize', 'DotProduct', 'CrossProduct', 'ComponentMask',
  'AppendVector', 'BreakMaterialAttributes', 'MakeMaterialAttributes',
  'ScalarParameter', 'VectorParameter', 'TextureObjectParameter',
  'Time', 'Panner', 'Rotator', 'WorldPosition', 'VertexNormalWS',
  'CameraPositionWS', 'PixelDepth', 'SceneDepth', 'Noise', 'If',
];

// Material output pins
const MATERIAL_OUTPUTS = [
  'BaseColor', 'Metallic', 'Specular', 'Roughness', 'Normal',
  'Emissive', 'Opacity', 'OpacityMask', 'AmbientOcclusion',
  'Refraction', 'PixelDepthOffset', 'SubsurfaceColor',
];

/**
 * Add a node to blueprint or material graph
 */
async function addNode(params: {
  nodeType: string;
  position?: { x: number; y: number };
  graphType?: 'blueprint' | 'material';
}): Promise<ToolResult> {
  const logger = getLogger();
  const { nodeType, position, graphType = 'material' } = params;

  try {
    if (!nodeType || nodeType.trim() === '') {
      return {
        success: false,
        error: createError(ErrorCode.UE5_OPERATION_FAILED, 'Node type is required'),
      };
    }

    logger.debug(`Adding ${graphType} node: ${nodeType} at (${position?.x || 0}, ${position?.y || 0})`);

    // In full implementation:
    // 1. Right-click at position to open context menu
    // 2. Search for node type
    // 3. Click to add node
    // 4. Return node identifier for future reference

    return {
      success: true,
      data: {
        added: false,
        message: `${graphType} node creation requires GUI automation`,
        nodeType,
        position: position || { x: 0, y: 0 },
        graphType,
        availableTypes: graphType === 'material' ? MATERIAL_EXPRESSIONS.slice(0, 10) : [],
      },
    };
  } catch (error) {
    logger.error(`Add node failed: ${error}`);
    return {
      success: false,
      error: createError(
        ErrorCode.UE5_OPERATION_FAILED,
        `Failed to add node: ${error instanceof Error ? error.message : String(error)}`
      ),
    };
  }
}

/**
 * Connect two node pins in the graph
 */
async function connectPins(params: {
  sourceNode: string;
  sourcePin: string;
  targetNode: string;
  targetPin: string;
}): Promise<ToolResult> {
  const logger = getLogger();
  const { sourceNode, sourcePin, targetNode, targetPin } = params;

  try {
    if (!sourceNode || !sourcePin || !targetNode || !targetPin) {
      return {
        success: false,
        error: createError(
          ErrorCode.UE5_OPERATION_FAILED,
          'All connection parameters are required: sourceNode, sourcePin, targetNode, targetPin'
        ),
      };
    }

    logger.debug(`Connecting: ${sourceNode}.${sourcePin} -> ${targetNode}.${targetPin}`);

    // In full implementation:
    // 1. Find source node visually
    // 2. Locate source pin
    // 3. Drag from source pin
    // 4. Find target node
    // 5. Drop on target pin

    return {
      success: true,
      data: {
        connected: false,
        message: 'Pin connection requires visual recognition for pin location',
        connection: { sourceNode, sourcePin, targetNode, targetPin },
      },
    };
  } catch (error) {
    logger.error(`Connect pins failed: ${error}`);
    return {
      success: false,
      error: createError(
        ErrorCode.UE5_OPERATION_FAILED,
        `Failed to connect pins: ${error instanceof Error ? error.message : String(error)}`
      ),
    };
  }
}

/**
 * Find a node in the current graph by description
 */
async function findNode(params: {
  description: string;
  nodeType?: string;
}): Promise<ToolResult> {
  const logger = getLogger();
  const { description, nodeType } = params;

  try {
    if (!description || description.trim() === '') {
      return {
        success: false,
        error: createError(ErrorCode.UE5_ELEMENT_NOT_FOUND, 'Node description is required'),
      };
    }

    logger.debug(`Finding node: "${description}" (type: ${nodeType || 'any'})`);

    return {
      success: true,
      data: {
        found: false,
        message: 'Node finding requires visual recognition',
        searchCriteria: { description, nodeType },
      },
    };
  } catch (error) {
    logger.error(`Find node failed: ${error}`);
    return {
      success: false,
      error: createError(
        ErrorCode.UE5_OPERATION_FAILED,
        `Failed to find node: ${error instanceof Error ? error.message : String(error)}`
      ),
    };
  }
}

/**
 * Set a parameter value on a node
 */
async function setNodeValue(params: {
  nodeDescription: string;
  parameterName: string;
  value: string | number | boolean;
}): Promise<ToolResult> {
  const logger = getLogger();
  const { nodeDescription, parameterName, value } = params;

  try {
    if (!nodeDescription || !parameterName) {
      return {
        success: false,
        error: createError(
          ErrorCode.UE5_OPERATION_FAILED,
          'Node description and parameter name are required'
        ),
      };
    }

    logger.debug(`Setting ${nodeDescription}.${parameterName} = ${value}`);

    return {
      success: true,
      data: {
        set: false,
        message: 'Value setting requires node selection and input field interaction',
        nodeDescription,
        parameterName,
        value,
      },
    };
  } catch (error) {
    logger.error(`Set node value failed: ${error}`);
    return {
      success: false,
      error: createError(
        ErrorCode.UE5_OPERATION_FAILED,
        `Failed to set value: ${error instanceof Error ? error.message : String(error)}`
      ),
    };
  }
}

/**
 * Create a material expression node
 */
async function createMaterialExpression(params: {
  expressionType: string;
  position?: { x: number; y: number };
}): Promise<ToolResult> {
  const logger = getLogger();
  const { expressionType, position } = params;

  try {
    if (!expressionType || expressionType.trim() === '') {
      return {
        success: false,
        error: createError(ErrorCode.UE5_OPERATION_FAILED, 'Expression type is required'),
      };
    }

    // Validate expression type
    const isKnownType = MATERIAL_EXPRESSIONS.some(
      t => t.toLowerCase() === expressionType.toLowerCase()
    );

    logger.debug(`Creating material expression: ${expressionType}`);

    return {
      success: true,
      data: {
        created: false,
        message: 'Material expression creation requires GUI automation',
        expressionType,
        isKnownType,
        position: position || { x: 0, y: 0 },
        availableExpressions: MATERIAL_EXPRESSIONS,
      },
    };
  } catch (error) {
    logger.error(`Create expression failed: ${error}`);
    return {
      success: false,
      error: createError(
        ErrorCode.UE5_OPERATION_FAILED,
        `Failed to create expression: ${error instanceof Error ? error.message : String(error)}`
      ),
    };
  }
}

/**
 * Connect a material node to material output
 */
async function connectToMaterialOutput(params: {
  sourceNode: string;
  sourceOutput?: string;
  materialOutput: string;
}): Promise<ToolResult> {
  const logger = getLogger();
  const { sourceNode, sourceOutput = 'RGB', materialOutput } = params;

  try {
    if (!sourceNode || !materialOutput) {
      return {
        success: false,
        error: createError(
          ErrorCode.UE5_OPERATION_FAILED,
          'Source node and material output are required'
        ),
      };
    }

    // Validate material output
    const isValidOutput = MATERIAL_OUTPUTS.some(
      o => o.toLowerCase() === materialOutput.toLowerCase()
    );

    if (!isValidOutput) {
      return {
        success: false,
        error: createError(
          ErrorCode.UE5_OPERATION_FAILED,
          `Invalid material output: ${materialOutput}. Valid outputs: ${MATERIAL_OUTPUTS.join(', ')}`
        ),
      };
    }

    logger.debug(`Connecting ${sourceNode}.${sourceOutput} -> Material.${materialOutput}`);

    return {
      success: true,
      data: {
        connected: false,
        message: 'Material output connection requires GUI automation',
        sourceNode,
        sourceOutput,
        materialOutput,
        validOutputs: MATERIAL_OUTPUTS,
      },
    };
  } catch (error) {
    logger.error(`Connect to material output failed: ${error}`);
    return {
      success: false,
      error: createError(
        ErrorCode.UE5_OPERATION_FAILED,
        `Failed to connect: ${error instanceof Error ? error.message : String(error)}`
      ),
    };
  }
}

/**
 * Pan and zoom the node graph view
 */
async function navigateGraph(params: {
  action: 'pan' | 'zoom' | 'fit_all' | 'focus_node';
  deltaX?: number;
  deltaY?: number;
  zoomLevel?: number;
  nodeDescription?: string;
}): Promise<ToolResult> {
  const logger = getLogger();
  const { action, deltaX, deltaY, zoomLevel, nodeDescription } = params;

  try {
    logger.debug(`Graph navigation: ${action}`);

    switch (action) {
      case 'pan':
        if (deltaX === undefined && deltaY === undefined) {
          return {
            success: false,
            error: createError(ErrorCode.UE5_OPERATION_FAILED, 'Pan requires deltaX or deltaY'),
          };
        }
        break;
      case 'zoom':
        if (zoomLevel === undefined) {
          return {
            success: false,
            error: createError(ErrorCode.UE5_OPERATION_FAILED, 'Zoom requires zoomLevel'),
          };
        }
        break;
      case 'focus_node':
        if (!nodeDescription) {
          return {
            success: false,
            error: createError(ErrorCode.UE5_OPERATION_FAILED, 'Focus requires nodeDescription'),
          };
        }
        break;
    }

    return {
      success: true,
      data: {
        navigated: false,
        message: 'Graph navigation requires GUI automation',
        action,
        params: { deltaX, deltaY, zoomLevel, nodeDescription },
      },
    };
  } catch (error) {
    logger.error(`Navigate graph failed: ${error}`);
    return {
      success: false,
      error: createError(
        ErrorCode.UE5_OPERATION_FAILED,
        `Failed to navigate: ${error instanceof Error ? error.message : String(error)}`
      ),
    };
  }
}

// Tool definitions
export const addNodeTool: ToolDefinition = {
  name: 'ue_blueprint_add_node',
  description: 'Add a node to blueprint or material graph',
  inputSchema: {
    type: 'object',
    properties: {
      nodeType: {
        type: 'string',
        description: 'Node type name, e.g., "TextureSample", "Multiply"',
      },
      position: {
        type: 'object',
        properties: {
          x: { type: 'number' },
          y: { type: 'number' },
        },
        description: 'Position in graph coordinates',
      },
      graphType: {
        type: 'string',
        enum: ['blueprint', 'material'],
        description: 'Type of graph (default: material)',
      },
    },
    required: ['nodeType'],
  },
  handler: async (params: unknown) => addNode(params as {
    nodeType: string;
    position?: { x: number; y: number };
    graphType?: 'blueprint' | 'material';
  }),
};

export const connectPinsTool: ToolDefinition = {
  name: 'ue_blueprint_connect_pins',
  description: 'Connect two node pins in the graph',
  inputSchema: {
    type: 'object',
    properties: {
      sourceNode: { type: 'string', description: 'Source node identifier or description' },
      sourcePin: { type: 'string', description: 'Source pin name' },
      targetNode: { type: 'string', description: 'Target node identifier or description' },
      targetPin: { type: 'string', description: 'Target pin name' },
    },
    required: ['sourceNode', 'sourcePin', 'targetNode', 'targetPin'],
  },
  handler: async (params: unknown) => connectPins(params as {
    sourceNode: string;
    sourcePin: string;
    targetNode: string;
    targetPin: string;
  }),
};

export const findNodeTool: ToolDefinition = {
  name: 'ue_blueprint_find_node',
  description: 'Find a node in the current graph by description',
  inputSchema: {
    type: 'object',
    properties: {
      description: { type: 'string', description: 'Visual description of the node' },
      nodeType: { type: 'string', description: 'Optional node type filter' },
    },
    required: ['description'],
  },
  handler: async (params: unknown) => findNode(params as {
    description: string;
    nodeType?: string;
  }),
};

export const setNodeValueTool: ToolDefinition = {
  name: 'ue_blueprint_set_value',
  description: 'Set a parameter value on a node',
  inputSchema: {
    type: 'object',
    properties: {
      nodeDescription: { type: 'string', description: 'Description of the target node' },
      parameterName: { type: 'string', description: 'Name of the parameter to set' },
      value: {
        oneOf: [{ type: 'string' }, { type: 'number' }, { type: 'boolean' }],
        description: 'Value to set',
      },
    },
    required: ['nodeDescription', 'parameterName', 'value'],
  },
  handler: async (params: unknown) => setNodeValue(params as {
    nodeDescription: string;
    parameterName: string;
    value: string | number | boolean;
  }),
};

export const createExpressionTool: ToolDefinition = {
  name: 'ue_material_create_expression',
  description: 'Create a material expression node',
  inputSchema: {
    type: 'object',
    properties: {
      expressionType: {
        type: 'string',
        description: 'Expression type: TextureSample, Multiply, Add, Lerp, etc.',
      },
      position: {
        type: 'object',
        properties: {
          x: { type: 'number' },
          y: { type: 'number' },
        },
      },
    },
    required: ['expressionType'],
  },
  handler: async (params: unknown) => createMaterialExpression(params as {
    expressionType: string;
    position?: { x: number; y: number };
  }),
};

export const connectMaterialOutputTool: ToolDefinition = {
  name: 'ue_material_connect',
  description: 'Connect a material node to material output',
  inputSchema: {
    type: 'object',
    properties: {
      sourceNode: { type: 'string', description: 'Source node description' },
      sourceOutput: { type: 'string', description: 'Source output pin (default: RGB)' },
      materialOutput: {
        type: 'string',
        enum: MATERIAL_OUTPUTS,
        description: 'Material output to connect to',
      },
    },
    required: ['sourceNode', 'materialOutput'],
  },
  handler: async (params: unknown) => connectToMaterialOutput(params as {
    sourceNode: string;
    sourceOutput?: string;
    materialOutput: string;
  }),
};

export const navigateGraphTool: ToolDefinition = {
  name: 'ue_graph_navigate',
  description: 'Pan and zoom the node graph view',
  inputSchema: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['pan', 'zoom', 'fit_all', 'focus_node'],
        description: 'Navigation action',
      },
      deltaX: { type: 'number', description: 'Pan X delta (for pan action)' },
      deltaY: { type: 'number', description: 'Pan Y delta (for pan action)' },
      zoomLevel: { type: 'number', description: 'Zoom level (for zoom action)' },
      nodeDescription: { type: 'string', description: 'Node to focus (for focus_node action)' },
    },
    required: ['action'],
  },
  handler: async (params: unknown) => navigateGraph(params as {
    action: 'pan' | 'zoom' | 'fit_all' | 'focus_node';
    deltaX?: number;
    deltaY?: number;
    zoomLevel?: number;
    nodeDescription?: string;
  }),
};

// Export all blueprint/material tools
export const blueprintTools: ToolDefinition[] = [
  addNodeTool,
  connectPinsTool,
  findNodeTool,
  setNodeValueTool,
  createExpressionTool,
  connectMaterialOutputTool,
  navigateGraphTool,
];

// Export functions for testing
export {
  addNode,
  connectPins,
  findNode,
  setNodeValue,
  createMaterialExpression,
  connectToMaterialOutput,
  navigateGraph,
  MATERIAL_EXPRESSIONS,
  MATERIAL_OUTPUTS,
};
