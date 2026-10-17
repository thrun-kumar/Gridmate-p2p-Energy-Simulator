async function testStatic() {
  try {
    const iconsRes = await fetch('http://localhost:5000/js/icons.js');
    const iconsText = await iconsRes.text();
    console.log('icons.js HTTP status:', iconsRes.status);
    console.log('icons.js includes "info:":', iconsText.includes('info:'));
    console.log('icons.js includes "edit:":', iconsText.includes('edit:'));

    const sellerRes = await fetch('http://localhost:5000/js/components/sellerDashboard.js');
    const sellerText = await sellerRes.text();
    console.log('sellerDashboard.js HTTP status:', sellerRes.status);
    console.log('sellerDashboard.js includes "Accept Recommended Price":', sellerText.includes('Accept Recommended Price'));
    console.log('sellerDashboard.js safe info check:', sellerText.includes('window.Icons?.info'));
  } catch (err) {
    console.error('Error:', err.message);
  }
}

testStatic();
