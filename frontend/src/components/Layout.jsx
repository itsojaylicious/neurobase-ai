import Sidebar from './Sidebar';

export default function Layout({ children, onLogout }) {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar onLogout={onLogout} />
      <main className="flex-1 relative overflow-y-auto overflow-x-hidden">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary-600/10 rounded-full blur-[120px] pointer-events-none -translate-y-1/2"></div>
        <div className="absolute bottom-0 right-1/4 w-[30rem] h-[30rem] bg-accent-600/5 rounded-full blur-[150px] pointer-events-none translate-y-1/4"></div>
        <div className="p-6 h-full relative z-10 w-full max-w-7xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
