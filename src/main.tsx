import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '@fontsource/barlow-condensed/700.css';
import '@fontsource/barlow-condensed/800.css';
import '@fontsource/manrope/400.css';
import '@fontsource/manrope/600.css';
import '@fontsource/manrope/800.css';
import './styles.css';
import { App } from './App';
import { SettingsProvider } from './state';
import { LanguageProvider } from './i18n';

const queryClient=new QueryClient();
class ErrorBoundary extends React.Component<{children:React.ReactNode},{failed:boolean}>{state={failed:false};static getDerivedStateFromError(){return {failed:true};}render(){return this.state.failed?<main className="empty"><h1>这个页面暂时无法显示</h1><p>请刷新页面重试，你的筛选条件保留在链接中。</p><button onClick={()=>window.location.reload()}>重新载入</button><a href={import.meta.env.BASE_URL}>返回首页</a></main>:this.props.children;}}
const fallback=new URLSearchParams(window.location.search).get('__route');
if(fallback&&fallback.startsWith('/')&&!fallback.startsWith('//'))window.history.replaceState(null,'',import.meta.env.BASE_URL.replace(/\/$/,'')+fallback);
ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><ErrorBoundary><QueryClientProvider client={queryClient}><SettingsProvider><LanguageProvider><BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/,'')}><App/></BrowserRouter></LanguageProvider></SettingsProvider></QueryClientProvider></ErrorBoundary></React.StrictMode>);
