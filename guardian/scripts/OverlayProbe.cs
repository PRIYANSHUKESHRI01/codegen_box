// A throw-away window that behaves like the "invisible assistant" overlays this project defends against:
//   - always on top, click-through, covering the screen        (WS_EX_TOPMOST | WS_EX_LAYERED | WS_EX_TRANSPARENT)
//   - hidden from screen capture and screen sharing             (SetWindowDisplayAffinity WDA_EXCLUDEFROMCAPTURE)
// It draws nothing and takes no input. scripts/verify-windows.ps1 compiles and runs it to prove the Guardian sees it.
using System;
using System.Runtime.InteropServices;
using System.Windows.Forms;

static class OverlayProbe
{
    [DllImport("user32.dll")] static extern bool SetWindowDisplayAffinity(IntPtr hwnd, uint affinity);

    [STAThread]
    static void Main(string[] args)
    {
        bool excludeFromCapture = args.Length > 0 && args[0] == "capture";
        var f = new Form
        {
            FormBorderStyle = FormBorderStyle.None,
            ShowInTaskbar = false,
            TopMost = true,
            StartPosition = FormStartPosition.Manual,
            Bounds = Screen.PrimaryScreen.Bounds,
            BackColor = System.Drawing.Color.Black,
            Opacity = 0.01,
            Text = "probe overlay",
        };
        f.Load += (s, e) =>
        {
            var style = GetWindowLong(f.Handle, -20);
            SetWindowLong(f.Handle, -20, style | 0x80000 | 0x20 | 0x80); // LAYERED | TRANSPARENT | TOOLWINDOW
            if (excludeFromCapture) SetWindowDisplayAffinity(f.Handle, 0x11);
        };
        var t = new Timer { Interval = 20000 };
        t.Tick += (s, e) => Application.Exit();
        t.Start();
        Application.Run(f);
    }

    [DllImport("user32.dll")] static extern int GetWindowLong(IntPtr h, int i);
    [DllImport("user32.dll")] static extern int SetWindowLong(IntPtr h, int i, int v);
}
