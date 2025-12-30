/**
 * 家庭关怀页面
 */

import { useState, useEffect } from 'react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import {
  addFamilyMember,
  getFamilyMembers,
  addGrowthRecord,
  getGrowthRecords,
  getUpcomingReminders,
  addCareReminder,
  completeReminder,
  type FamilyMember,
  type FamilyMemberType,
  type GrowthRecord,
  type CareReminder,
} from '../services/family';
import {
  UserPlus, Baby, Users, Heart, Calendar,
  Plus, Check, Bell,
} from 'lucide-react';

// 成员类型选项
const MEMBER_TYPES: { type: FamilyMemberType; label: string; icon: typeof Baby }[] = [
  { type: 'child', label: '孩子', icon: Baby },
  { type: 'parent', label: '父母', icon: Users },
  { type: 'spouse', label: '配偶', icon: Heart },
  { type: 'other', label: '其他', icon: Users },
];

export default function FamilyPage() {
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [records, setRecords] = useState<GrowthRecord[]>([]);
  const [reminders, setReminders] = useState<CareReminder[]>([]);
  const [showAddMember, setShowAddMember] = useState(false);
  const [showAddRecord, setShowAddRecord] = useState(false);
  const [selectedMember, setSelectedMember] = useState<string | null>(null);

  // 新成员表单
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<FamilyMemberType>('child');
  const [newBirthday, setNewBirthday] = useState('');

  // 新记录表单
  const [recordTitle, setRecordTitle] = useState('');
  const [recordContent, setRecordContent] = useState('');

  // 加载数据
  useEffect(() => {
    setMembers(getFamilyMembers());
    setRecords(getGrowthRecords());
    setReminders(getUpcomingReminders(14));
  }, []);

  // 添加成员
  const handleAddMember = () => {
    if (!newName) return;
    addFamilyMember(newName, newType, newBirthday || undefined);
    setMembers(getFamilyMembers());
    setNewName('');
    setNewBirthday('');
    setShowAddMember(false);

    // 如果有生日，自动添加生日提醒
    if (newBirthday) {
      const member = getFamilyMembers().find(m => m.name === newName);
      if (member) {
        addCareReminder(member.id, 'birthday', `${newName}的生日`, newBirthday, 'yearly');
        setReminders(getUpcomingReminders(14));
      }
    }
  };

  // 添加成长记录
  const handleAddRecord = () => {
    if (!selectedMember || !recordTitle) return;
    addGrowthRecord(selectedMember, recordTitle, recordContent, 'memory');
    setRecords(getGrowthRecords());
    setRecordTitle('');
    setRecordContent('');
    setShowAddRecord(false);
  };

  // 完成提醒
  const handleCompleteReminder = (id: string) => {
    completeReminder(id);
    setReminders(getUpcomingReminders(14));
  };

  return (
    <div className="p-4 space-y-4">
      {/* 标题 */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">家庭关怀</h1>
        <Button size="sm" onClick={() => setShowAddMember(true)}>
          <UserPlus className="h-4 w-4 mr-1" />
          添加成员
        </Button>
      </div>

      {/* 添加成员表单 */}
      {showAddMember && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">添加家庭成员</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input
              placeholder="姓名"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
            <div className="grid grid-cols-4 gap-2">
              {MEMBER_TYPES.map(({ type, label, icon: Icon }) => (
                <button
                  key={type}
                  onClick={() => setNewType(type)}
                  className={`p-2 rounded-lg border transition-colors ${
                    newType === type
                      ? 'border-primary bg-primary/10'
                      : 'border-border hover:bg-accent'
                  }`}
                >
                  <Icon className="h-4 w-4 mx-auto" />
                  <span className="text-xs mt-1 block">{label}</span>
                </button>
              ))}
            </div>
            <Input
              type="date"
              placeholder="生日"
              value={newBirthday}
              onChange={(e) => setNewBirthday(e.target.value)}
            />
            <div className="flex gap-2">
              <Button onClick={handleAddMember} disabled={!newName}>
                添加
              </Button>
              <Button variant="outline" onClick={() => setShowAddMember(false)}>
                取消
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 家庭成员列表 */}
      {members.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">家庭成员</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {members.map((member) => {
                const typeInfo = MEMBER_TYPES.find(t => t.type === member.type);
                const Icon = typeInfo?.icon || Users;
                return (
                  <div
                    key={member.id}
                    className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors ${
                      selectedMember === member.id
                        ? 'bg-primary/10'
                        : 'hover:bg-accent'
                    }`}
                    onClick={() => setSelectedMember(
                      selectedMember === member.id ? null : member.id
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <Icon className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="font-medium text-sm">{member.name}</p>
                        {member.birthday && (
                          <p className="text-xs text-muted-foreground">
                            {member.birthday}
                          </p>
                        )}
                      </div>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {typeInfo?.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 添加记录按钮 */}
      {selectedMember && (
        <Button
          variant="outline"
          className="w-full"
          onClick={() => setShowAddRecord(true)}
        >
          <Plus className="h-4 w-4 mr-1" />
          添加成长记录
        </Button>
      )}

      {/* 添加记录表单 */}
      {showAddRecord && selectedMember && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">添加成长记录</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input
              placeholder="标题"
              value={recordTitle}
              onChange={(e) => setRecordTitle(e.target.value)}
            />
            <Textarea
              placeholder="记录内容..."
              value={recordContent}
              onChange={(e) => setRecordContent(e.target.value)}
              rows={3}
            />
            <div className="flex gap-2">
              <Button onClick={handleAddRecord} disabled={!recordTitle}>
                保存
              </Button>
              <Button variant="outline" onClick={() => setShowAddRecord(false)}>
                取消
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 成长记录 */}
      {selectedMember && records.filter(r => r.memberId === selectedMember).length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">成长记录</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {records
                .filter(r => r.memberId === selectedMember)
                .sort((a, b) => b.date.localeCompare(a.date))
                .map((record) => (
                  <div key={record.id} className="border-l-2 border-primary pl-3 py-1">
                    <p className="text-xs text-muted-foreground">{record.date}</p>
                    <p className="font-medium text-sm">{record.title}</p>
                    {record.content && (
                      <p className="text-sm text-muted-foreground mt-1">
                        {record.content}
                      </p>
                    )}
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 关怀提醒 */}
      {reminders.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Bell className="h-4 w-4" />
              关怀提醒
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {reminders.map((reminder) => {
                const member = members.find(m => m.id === reminder.memberId);
                return (
                  <div
                    key={reminder.id}
                    className="flex items-center justify-between py-2 border-b last:border-0"
                  >
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">{reminder.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {member?.name} · {reminder.dueDate}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleCompleteReminder(reminder.id)}
                    >
                      <Check className="h-4 w-4" />
                    </Button>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 空状态 */}
      {members.length === 0 && (
        <Card>
          <CardContent className="p-6 text-center">
            <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              添加家庭成员，开始记录美好时光
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
