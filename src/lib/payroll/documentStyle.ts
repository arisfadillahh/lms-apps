/** Shared by the isolated admin preview and the printable salary document. */
export const payrollDocumentStyle = `
@page{size:A4;margin:14mm 13mm 18mm}
*{box-sizing:border-box}
html{background:#f3f4f6;color:#1f2937;-webkit-text-size-adjust:100%}
body{margin:0;padding:24px;font:14px/1.5 'Segoe UI',-apple-system,BlinkMacSystemFont,'Helvetica Neue',Arial,sans-serif}
.payslip{max-width:880px;margin:0 auto;background:#fff;border-radius:24px;box-shadow:0 16px 48px #17255412;overflow:hidden}
.document-header{position:relative;padding:34px 36px 76px;color:#fff;background:radial-gradient(circle at 90% 10%,#00b0d740,transparent 45%),radial-gradient(circle at 10% 90%,#00b0d726,transparent 45%),linear-gradient(135deg,#172554,#22367b 50%,#1e40af)}
.header-content{position:relative;z-index:1;display:flex;justify-content:space-between;align-items:center;gap:24px}
.brand-logo{display:block;width:164px;height:auto;max-width:100%}
.document-heading{text-align:right;min-width:0}
.document-heading h1{margin:0;font-size:34px;line-height:1.05;letter-spacing:-1.2px;font-weight:800;color:#fff}
.document-period{margin:8px 0 0;color:#e0eaff;font-size:14px}
.document-state{display:inline-flex;align-items:center;gap:6px;margin-top:10px;border-radius:99px;padding:4px 9px;border:1px solid #ffffff40;background:#ffffff0d;color:#e8efff;font-size:9px;font-weight:650;letter-spacing:.6px}
.header-circle{position:absolute;border-radius:50%;border:1px solid #ffffff10;pointer-events:none}
.header-circle.one{width:240px;height:240px;right:-85px;top:-120px}
.header-circle.two{width:150px;height:150px;left:35%;bottom:-105px}
.summary-grid{position:relative;z-index:2;display:grid;grid-template-columns:1.08fr 1fr;gap:16px;margin:-42px 28px 0}
.info-card{min-width:0;background:#fff;border:1px solid #edf0f6;border-radius:18px;padding:23px 24px;box-shadow:0 8px 24px #1725540a;break-inside:avoid}
.eyebrow{display:flex;align-items:center;gap:7px;color:#078cae;font-size:10px;font-weight:750;letter-spacing:1.1px;text-transform:uppercase}
.dot{width:6px;height:6px;border-radius:50%;background:#00b0d7;flex-shrink:0}
.recipient-name{margin:12px 0 3px;font-size:23px;font-weight:750;line-height:1.25;letter-spacing:-.65px;color:#172554;overflow-wrap:anywhere}
.recipient-role{margin:0;color:#657089;font-size:12px;overflow-wrap:anywhere}
.contract{display:inline-block;margin-left:7px;padding-left:8px;border-left:1px solid #dce2ec;color:#22367b;font-weight:600}
.activity-period{margin-top:19px;padding-top:14px;border-top:1px solid #eef1f6}
.meta-label{color:#8790a4;font-size:10px;display:block;margin-bottom:3px}
.meta-value{color:#39435c;font-size:12px}
.net-card{display:flex;flex-direction:column;justify-content:space-between;gap:16px;background:linear-gradient(140deg,#fff 60%,#f6f9ee)}
.net-card .eyebrow{color:#526e25}.net-card .dot{background:#9dc83b}
.net-amount{display:block;margin-top:10px;font-size:31px;font-weight:800;letter-spacing:-1.1px;line-height:1.2;color:#22367b;font-variant-numeric:tabular-nums;overflow-wrap:anywhere}
.payment-status{display:inline-flex;align-items:center;gap:7px;width:fit-content;font-size:10px;color:#68738b;background:#f2f5fa;padding:5px 9px;border-radius:99px}
.payment-status.paid{background:#eff6df;color:#4f6d23}.status-dot{height:5px;width:5px;background:currentColor;border-radius:50%}
.document-body{padding:28px 32px 26px}
.section-heading{display:flex;justify-content:space-between;align-items:baseline;gap:12px;margin-bottom:14px}
.section-heading h2{font-size:15px;letter-spacing:-.25px;color:#22367b;margin:0;font-weight:750}
.component-count{font-size:10px;color:#8992a5;white-space:nowrap}
.earnings-list{margin:0;padding:0;display:flex;flex-direction:column;gap:8px}
.earning{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:16px;align-items:center;padding:13px 16px;border-radius:11px;background:#f6f8fb;break-inside:avoid}
.earning dt{color:#46516a;font-size:12px;font-weight:550;overflow-wrap:anywhere}.earning dd{margin:0;font-size:13px;font-weight:700;color:#22367b;white-space:nowrap;font-variant-numeric:tabular-nums}
.earning.salary{background:#eef2fa}.earning.salary dt{color:#22367b;font-weight:700}
.earning.deduction dd{color:#a14444}
.quantity{font-size:10px;color:#8a93a5;font-weight:400;margin-left:7px;white-space:nowrap}
.empty{font-size:12px;color:#7a849a;padding:20px 0}
.document-note{margin:20px 2px 0;color:#8790a4;font-size:10px;line-height:1.6}
.document-footer{display:flex;justify-content:space-between;gap:16px;align-items:center;margin-top:22px;padding-top:16px;border-top:1px solid #eef1f6;color:#8992a5;font-size:9px}
.footer-brand{font-weight:650;color:#596781}
@media screen and (max-width:600px){
 body{padding:12px;font-size:13px}.payslip{border-radius:18px}.document-header{padding:26px 22px 68px}.header-content{gap:14px;align-items:flex-start}.brand-logo{width:116px;margin-top:4px}.document-heading h1{font-size:25px;letter-spacing:-.8px}.document-period{font-size:11px;margin-top:7px}.document-state{font-size:8px;padding:3px 7px;letter-spacing:.2px}
 .summary-grid{grid-template-columns:1fr;gap:10px;margin:-38px 16px 0}.info-card{padding:20px}.recipient-name{font-size:22px}.activity-period{margin-top:13px;padding-top:11px}.net-card{gap:14px}.net-amount{font-size:32px;margin-top:8px}.document-body{padding:24px 18px}.earning{padding:13px 12px;gap:12px}.earning dt{font-size:11px}.earning dd{font-size:12px}.quantity{display:block;margin:4px 0 0}.document-footer{align-items:flex-start;gap:12px}.section-heading h2{font-size:14px}
}
@media print{
 html,body{background:#fff}body{padding:0;font-size:11px;-webkit-print-color-adjust:exact;print-color-adjust:exact}.payslip{max-width:none;border-radius:0;box-shadow:none;overflow:visible}.document-header{padding:26px 28px 66px;border-radius:17px;break-inside:avoid}.brand-logo{width:145px}.document-heading h1{font-size:30px}.summary-grid{margin:-36px 20px 0;gap:12px}.info-card{padding:20px;box-shadow:none;border-color:#e9edf4}.recipient-name{font-size:21px}.net-amount{font-size:27px}.document-body{padding:25px 22px 0}.earning{padding:11px 14px}.document-note,.document-footer{font-size:9px}.document-footer{break-inside:avoid}
}
`;
