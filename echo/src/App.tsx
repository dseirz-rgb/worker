import { Route, Switch } from "wouter";
import Dashboard from "./pages/Dashboard";
import NotesPage from "./pages/Notes";
import TasksPage from "./pages/Tasks";
import ChatPage from "./pages/Chat";
import ActivityPage from "./pages/Activity";
import TranslationPage from "./pages/Translation";
import FilesPage from "./pages/Files";
import GitHubPage from "./pages/GitHub";
import InvestmentPage from "./pages/Investment";
import HealthPage from "./pages/Health";
import EmotionPage from "./pages/Emotion";
import FamilyPage from "./pages/Family";
import TeamPage from "./pages/Team";
import LearningPage from "./pages/Learning";
import SettingsPage from "./pages/Settings";
import KnowledgePage from "./pages/Knowledge";
import { NavigationBar } from "./components/navigation/NavigationBar";
import { MobileNavBar } from "./components/navigation/MobileNavBar";
import { MobileFAB } from "./components/navigation/MobileFAB";

function App() {
  return (
    <div className="min-h-screen bg-background flex flex-col sm:flex-row">
      {/* 桌面端侧边导航 */}
      <NavigationBar />
      
      {/* 移动端底部导航 */}
      <MobileNavBar />
      
      {/* 移动端快捷操作浮动按钮 */}
      <MobileFAB />
      
      {/* 主内容区 */}
      <main className="flex-1 pb-14 sm:pb-0 overflow-auto">
        <Switch>
          <Route path="/" component={Dashboard} />
          <Route path="/notes" component={NotesPage} />
          <Route path="/tasks" component={TasksPage} />
          <Route path="/chat" component={ChatPage} />
          <Route path="/knowledge" component={KnowledgePage} />
          <Route path="/activity" component={ActivityPage} />
          <Route path="/translate" component={TranslationPage} />
          <Route path="/files" component={FilesPage} />
          <Route path="/github" component={GitHubPage} />
          <Route path="/investment" component={InvestmentPage} />
          <Route path="/health" component={HealthPage} />
          <Route path="/emotion" component={EmotionPage} />
          <Route path="/family" component={FamilyPage} />
          <Route path="/team" component={TeamPage} />
          <Route path="/learning" component={LearningPage} />
          <Route path="/settings" component={SettingsPage} />
        </Switch>
      </main>
    </div>
  );
}

export default App;
