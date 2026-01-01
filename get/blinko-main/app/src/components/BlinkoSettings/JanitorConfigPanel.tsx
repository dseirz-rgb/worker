/**
 * Janitor 配置面板组件
 * 配置 inbox 目录、输出目录和分类规则
 */

import { observer } from 'mobx-react-lite';
import { useState, useEffect, useCallback } from 'react';
import { Icon } from '@/components/Common/Iconify/icons';
import { 
  Input, 
  Button, 
  Card, 
  CardBody, 
  CardHeader,
  Divider,
  Chip,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  useDisclosure,
  Slider,
  Tooltip,
} from '@heroui/react';
import { api } from '@/lib/trpc';
import { RootStore } from '@/store';
import { ToastPlugin } from '@/store/module/Toast/Toast';

// ============ 类型定义 ============

interface CategoryConfig {
  id?: string;
  name?: string;
  path: string;
  keywords: string[];
  color?: string;
}

interface JanitorFullConfig {
  groq: { model: string };
  ollama: { host: string; model: string };
  inbox_dirs: string[];
  output_base: string;
  confidence_threshold: number;
  categories: Record<string, CategoryConfig>;
}

// ============ 子组件 ============

// 目录列表项
const DirectoryItem = ({ 
  path, 
  onRemove, 
  onValidate,
  isValid,
}: { 
  path: string; 
  onRemove: () => void;
  onValidate: () => void;
  isValid?: boolean;
}) => (
  <div className="flex items-center gap-2 p-2 bg-default-50 rounded-lg group">
    <Icon icon="solar:folder-bold-duotone" className="w-5 h-5 text-warning flex-shrink-0" />
    <span className="flex-1 text-sm font-mono truncate">{path}</span>
    {isValid !== undefined && (
      <Tooltip content={isValid ? '路径有效' : '路径不存在'}>
        <Icon 
          icon={isValid ? 'solar:check-circle-bold' : 'solar:close-circle-bold'} 
          className={`w-4 h-4 ${isValid ? 'text-success' : 'text-danger'}`} 
        />
      </Tooltip>
    )}
    <Button
      isIconOnly
      size="sm"
      variant="light"
      className="opacity-0 group-hover:opacity-100 transition-opacity"
      onPress={onValidate}
    >
      <Icon icon="solar:refresh-linear" className="w-4 h-4" />
    </Button>
    <Button
      isIconOnly
      size="sm"
      variant="light"
      color="danger"
      className="opacity-0 group-hover:opacity-100 transition-opacity"
      onPress={onRemove}
    >
      <Icon icon="solar:trash-bin-trash-linear" className="w-4 h-4" />
    </Button>
  </div>
);

// 分类卡片
const CategoryCard = ({ 
  id,
  category, 
  onEdit, 
  onDelete,
}: { 
  id: string;
  category: CategoryConfig; 
  onEdit: () => void;
  onDelete: () => void;
}) => (
  <div 
    className="p-3 bg-default-50 rounded-lg border-l-4 group"
    style={{ borderLeftColor: category.color || '#808080' }}
  >
    <div className="flex items-start justify-between">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium">{category.name || id}</span>
          <span className="text-xs text-foreground/50 font-mono">{id}</span>
        </div>
        <p className="text-sm text-foreground/60 mt-1 font-mono">{category.path}</p>
        {category.keywords.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {category.keywords.slice(0, 5).map((kw, i) => (
              <Chip key={i} size="sm" variant="flat" className="text-xs">
                {kw}
              </Chip>
            ))}
            {category.keywords.length > 5 && (
              <Chip size="sm" variant="flat" className="text-xs">
                +{category.keywords.length - 5}
              </Chip>
            )}
          </div>
        )}
      </div>
      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button isIconOnly size="sm" variant="light" onPress={onEdit}>
          <Icon icon="solar:pen-linear" className="w-4 h-4" />
        </Button>
        <Button isIconOnly size="sm" variant="light" color="danger" onPress={onDelete}>
          <Icon icon="solar:trash-bin-trash-linear" className="w-4 h-4" />
        </Button>
      </div>
    </div>
  </div>
);

// ============ 主组件 ============

export const JanitorConfigPanel = observer(() => {
  const toast = RootStore.Get(ToastPlugin);
  
  // 状态
  const [config, setConfig] = useState<JanitorFullConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [pathValidation, setPathValidation] = useState<Record<string, boolean>>({});
  
  // 新增目录输入
  const [newInboxDir, setNewInboxDir] = useState('');
  
  // 分类编辑 Modal
  const { isOpen: isCategoryModalOpen, onOpen: openCategoryModal, onClose: closeCategoryModal } = useDisclosure();
  const [editingCategory, setEditingCategory] = useState<{ id: string; config: CategoryConfig } | null>(null);
  const [categoryForm, setCategoryForm] = useState({
    id: '',
    name: '',
    path: '',
    keywords: '',
    color: '#808080',
  });

  // 加载配置
  const loadConfig = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await api.janitor.getFullConfig.query();
      setConfig(data);
    } catch (error) {
      console.error('加载配置失败:', error);
      // 显示具体错误信息
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      toast.error(`加载配置失败: ${errorMessage}`);
      // toast.error('加载配置失败');
      setConfig(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  // 保存配置
  const saveConfig = async (updates: Partial<JanitorFullConfig>) => {
    try {
      setIsSaving(true);
      const updated = await api.janitor.updateFullConfig.mutate(updates);
      setConfig(updated);
      toast.success('配置已保存');
    } catch (error) {
      console.error('保存配置失败:', error);
      toast.error('保存配置失败');
    } finally {
      setIsSaving(false);
    }
  };

  // 验证路径
  const validatePath = async (path: string) => {
    try {
      const result = await api.janitor.validatePath.mutate({ path });
      setPathValidation(prev => ({ ...prev, [path]: result.exists && result.is_dir }));
    } catch (error) {
      setPathValidation(prev => ({ ...prev, [path]: false }));
    }
  };

  // 添加 inbox 目录
  const addInboxDir = async () => {
    if (!newInboxDir.trim() || !config) return;
    
    const newDirs = [...config.inbox_dirs, newInboxDir.trim()];
    await saveConfig({ inbox_dirs: newDirs });
    setNewInboxDir('');
    validatePath(newInboxDir.trim());
  };

  // 移除 inbox 目录
  const removeInboxDir = async (index: number) => {
    if (!config) return;
    const newDirs = config.inbox_dirs.filter((_, i) => i !== index);
    await saveConfig({ inbox_dirs: newDirs });
  };

  // 更新输出目录
  const updateOutputBase = async (value: string) => {
    await saveConfig({ output_base: value });
  };

  // 更新置信度阈值
  const updateConfidenceThreshold = async (value: number) => {
    await saveConfig({ confidence_threshold: value });
  };

  // 打开分类编辑
  const openCategoryEdit = (id?: string, category?: CategoryConfig) => {
    if (id && category) {
      setEditingCategory({ id, config: category });
      setCategoryForm({
        id,
        name: category.name || '',
        path: category.path,
        keywords: category.keywords.join(', '),
        color: category.color || '#808080',
      });
    } else {
      setEditingCategory(null);
      setCategoryForm({
        id: '',
        name: '',
        path: '',
        keywords: '',
        color: '#808080',
      });
    }
    openCategoryModal();
  };

  // 保存分类
  const saveCategory = async () => {
    if (!categoryForm.id || !categoryForm.path) {
      toast.error('请填写分类 ID 和路径');
      return;
    }

    const keywords = categoryForm.keywords
      .split(',')
      .map(k => k.trim())
      .filter(k => k.length > 0);

    try {
      if (editingCategory) {
        // 更新现有分类
        await api.janitor.updateCategory.mutate({
          categoryId: categoryForm.id,
          name: categoryForm.name || undefined,
          path: categoryForm.path,
          keywords,
          color: categoryForm.color,
        });
      } else {
        // 添加新分类
        await api.janitor.addCategory.mutate({
          categoryId: categoryForm.id,
          name: categoryForm.name || undefined,
          path: categoryForm.path,
          keywords,
          color: categoryForm.color,
        });
      }
      
      await loadConfig();
      closeCategoryModal();
      toast.success(editingCategory ? '分类已更新' : '分类已添加');
    } catch (error) {
      console.error('保存分类失败:', error);
      toast.error('保存分类失败');
    }
  };

  // 删除分类
  const deleteCategory = async (categoryId: string) => {
    try {
      await api.janitor.deleteCategory.mutate({ categoryId });
      await loadConfig();
      toast.success('分类已删除');
    } catch (error) {
      console.error('删除分类失败:', error);
      toast.error('删除分类失败');
    }
  };

  if (isLoading) {
    return (
      <Card className="p-2">
        <CardBody className="flex items-center justify-center h-40">
          <Icon icon="solar:refresh-linear" className="w-8 h-8 animate-spin text-primary" />
        </CardBody>
      </Card>
    );
  }

  if (!config) {
    return (
      <Card className="p-2">
        <CardBody className="flex flex-col items-center justify-center h-40 gap-4">
          <Icon icon="solar:danger-triangle-linear" className="w-8 h-8 text-warning" />
          <p className="text-foreground/60">无法加载配置，请检查 Janitor 服务是否运行</p>
          <Button variant="flat" onPress={loadConfig}>
            重试
          </Button>
        </CardBody>
      </Card>
    );
  }

  return (
    <>
      <Card className="p-2">
        <CardHeader className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-warning/10 flex items-center justify-center">
            <Icon icon="solar:settings-bold-duotone" className="w-5 h-5 text-warning" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold">目录配置</h3>
            <p className="text-sm text-foreground/60">
              配置 Janitor 监控的目录和输出位置
            </p>
          </div>
          {isSaving && (
            <Icon icon="solar:refresh-linear" className="w-5 h-5 animate-spin text-primary" />
          )}
        </CardHeader>
        
        <Divider />
        
        <CardBody className="space-y-6">
          {/* Inbox 目录列表 */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">监控目录 (Inbox)</label>
              <span className="text-xs text-foreground/50">{config.inbox_dirs.length} 个目录</span>
            </div>
            
            <div className="space-y-2">
              {config.inbox_dirs.map((dir, index) => (
                <DirectoryItem
                  key={index}
                  path={dir}
                  isValid={pathValidation[dir]}
                  onRemove={() => removeInboxDir(index)}
                  onValidate={() => validatePath(dir)}
                />
              ))}
              
              {config.inbox_dirs.length === 0 && (
                <p className="text-sm text-foreground/50 text-center py-4">
                  暂无监控目录，请添加
                </p>
              )}
            </div>
            
            {/* 添加新目录 */}
            <div className="flex gap-2">
              <Input
                size="sm"
                placeholder="~/Downloads/Inbox"
                value={newInboxDir}
                onValueChange={setNewInboxDir}
                onKeyDown={(e) => e.key === 'Enter' && addInboxDir()}
                startContent={<Icon icon="solar:folder-add-linear" className="text-foreground/50" />}
              />
              <Button
                size="sm"
                color="warning"
                variant="flat"
                onPress={addInboxDir}
                isDisabled={!newInboxDir.trim()}
              >
                添加
              </Button>
            </div>
          </div>

          <Divider />

          {/* 输出目录 */}
          <div className="space-y-2">
            <label className="text-sm font-medium">输出根目录</label>
            <Input
              placeholder="~/Echo"
              value={config.output_base}
              onValueChange={(v) => setConfig({ ...config, output_base: v })}
              onBlur={() => updateOutputBase(config.output_base)}
              startContent={<Icon icon="solar:folder-check-linear" className="text-foreground/50" />}
              description="整理后的文件将移动到此目录下的分类子目录"
            />
          </div>

          <Divider />

          {/* 置信度阈值 */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">置信度阈值</label>
              <span className="text-sm font-mono">{(config.confidence_threshold * 100).toFixed(0)}%</span>
            </div>
            <Slider
              size="sm"
              step={0.05}
              minValue={0}
              maxValue={1}
              value={config.confidence_threshold}
              onChange={(v) => setConfig({ ...config, confidence_threshold: v as number })}
              onChangeEnd={(v) => updateConfidenceThreshold(v as number)}
              className="max-w-full"
              color="warning"
            />
            <p className="text-xs text-foreground/50">
              低于此阈值的分类建议将被标记为低置信度
            </p>
          </div>
        </CardBody>
      </Card>

      {/* 分类配置卡片 */}
      <Card className="p-2 mt-4">
        <CardHeader className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Icon icon="solar:tag-bold-duotone" className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold">分类配置</h3>
            <p className="text-sm text-foreground/60">
              定义文件分类规则和关键词
            </p>
          </div>
          <Button
            size="sm"
            color="primary"
            variant="flat"
            startContent={<Icon icon="solar:add-circle-linear" />}
            onPress={() => openCategoryEdit()}
          >
            添加分类
          </Button>
        </CardHeader>
        
        <Divider />
        
        <CardBody>
          <div className="grid gap-3">
            {Object.entries(config.categories).map(([id, category]) => (
              <CategoryCard
                key={id}
                id={id}
                category={category}
                onEdit={() => openCategoryEdit(id, category)}
                onDelete={() => deleteCategory(id)}
              />
            ))}
            
            {Object.keys(config.categories).length === 0 && (
              <p className="text-sm text-foreground/50 text-center py-8">
                暂无分类配置，点击上方按钮添加
              </p>
            )}
          </div>
        </CardBody>
      </Card>

      {/* 分类编辑 Modal */}
      <Modal isOpen={isCategoryModalOpen} onClose={closeCategoryModal} size="lg">
        <ModalContent>
          <ModalHeader>
            {editingCategory ? '编辑分类' : '添加分类'}
          </ModalHeader>
          <ModalBody className="space-y-4">
            <Input
              label="分类 ID"
              placeholder="01_Investment"
              value={categoryForm.id}
              onValueChange={(v) => setCategoryForm({ ...categoryForm, id: v })}
              isDisabled={!!editingCategory}
              description="唯一标识符，用于配置文件"
            />
            <Input
              label="显示名称"
              placeholder="投资理财"
              value={categoryForm.name}
              onValueChange={(v) => setCategoryForm({ ...categoryForm, name: v })}
            />
            <Input
              label="输出路径"
              placeholder="01_Investment"
              value={categoryForm.path}
              onValueChange={(v) => setCategoryForm({ ...categoryForm, path: v })}
              description="相对于输出根目录的子目录"
            />
            <Input
              label="关键词"
              placeholder="财报, 股票, 投资, 基金"
              value={categoryForm.keywords}
              onValueChange={(v) => setCategoryForm({ ...categoryForm, keywords: v })}
              description="用逗号分隔，用于 AI 分类参考"
            />
            <div className="space-y-2">
              <label className="text-sm">标签颜色</label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={categoryForm.color}
                  onChange={(e) => setCategoryForm({ ...categoryForm, color: e.target.value })}
                  className="w-10 h-10 rounded cursor-pointer"
                />
                <Input
                  size="sm"
                  value={categoryForm.color}
                  onValueChange={(v) => setCategoryForm({ ...categoryForm, color: v })}
                  className="w-32"
                />
              </div>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="flat" onPress={closeCategoryModal}>
              取消
            </Button>
            <Button color="primary" onPress={saveCategory}>
              {editingCategory ? '保存' : '添加'}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
});
