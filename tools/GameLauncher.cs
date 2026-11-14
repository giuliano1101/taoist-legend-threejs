using System;
using System.Diagnostics;
using System.IO;
using System.Net;
using System.Threading;
using System.Windows.Forms;
class GameLauncher {
  [STAThread] static void Main() {
    try {
      string root=AppDomain.CurrentDomain.BaseDirectory;
      string url="http://127.0.0.1:4173/";
      if(!File.Exists(Path.Combine(root,"server.mjs"))) throw new Exception("找不到游戏文件，请先解压完整游戏文件夹。");
      if(!Ready(url)) {
        string node="node.exe";
        var server=new ProcessStartInfo(node,"\""+Path.Combine(root,"server.mjs")+"\"");
        server.WorkingDirectory=root;server.UseShellExecute=false;server.CreateNoWindow=true;Process.Start(server);
        for(int i=0;i<100&&!Ready(url);i++)Thread.Sleep(100);
      }
      if(!Ready(url))throw new Exception("游戏服务没有启动，请检查 Node.js 是否可用。");
      string chrome=Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles),@"Google\Chrome\Application\chrome.exe");
      if(!File.Exists(chrome))chrome=Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86),@"Microsoft\Edge\Application\msedge.exe");
      if(!File.Exists(chrome))throw new Exception("请安装 Chrome 或 Microsoft Edge 后启动游戏。");
      var browser=new ProcessStartInfo(chrome,"--app="+url+" --autoplay-policy=no-user-gesture-required --user-data-dir=\""+Path.Combine(root,".game-browser")+"\"");
      browser.WorkingDirectory=root;browser.UseShellExecute=false;Process.Start(browser);
    } catch(Exception e){MessageBox.Show(e.Message,"道士林正英传奇",MessageBoxButtons.OK,MessageBoxIcon.Error);}
  }
  static bool Ready(string url){try{var r=(HttpWebRequest)WebRequest.Create(url);r.Timeout=400;using(var response=(HttpWebResponse)r.GetResponse())return response.StatusCode==HttpStatusCode.OK;}catch{return false;}}
}
