// Datos inventados con el mismo formato que las exportaciones reales (para tests).

export const INVESTING_CSV = `"Resumen de posiciones"
"","Nombre","Símbolo","Mercado","Tipo","Cantidad","Precio medio","Precio actual","Val. mercado"
"","Fondo Indexado Mundo A","LP11111111","IR","Compra","15.00000000","10,000","12,000","180,00 €"
"","Empresa Ejemplo","EJE.MC","BME","Compra","150.00000000","2,0000","2,5000","375,00 €"
"","Otra Cosa ADR","OTRA.TG","TG","Compra","4.00000000","50,00","55,00","220,00 €"

"Val. mercado","775,00 €"


"Posiciones abiertas"
"","Nombre","Símbolo","Mercado","Fecha apertura","Tipo","Cantidad","Precio entrada","Precio actual","Comisión"
"","Fondo Indexado Mundo A","LP11111111","IR","03/02/2025","Compra","10.00000000","10,000","12,000","0,00 €"
"","Fondo Indexado Mundo A","LP11111111","IR","04/03/2025","Compra","5.00000000","10,000","12,000","0,00 €"
"","Empresa Ejemplo","EJE.MC","BME","10/01/2025","Compra","100.00000000","2,0000","2,5000","4,00 €"
"","Empresa Ejemplo","EJE.MC","BME","01/06/2025","Compra","50.00000000","2,0000","2,5000","1,00 €"
"","Otra Cosa ADR","OTRA.TG","TG","15/02/2025","Compra","4.00000000","50,00","55,00","1,00 €"


"Posiciones cerradas"
"","Nombre","Símbolo","Mercado","F. apertura","Tipo","Cantidad","Precio entrada","Fecha cierre","Precio cierre","%Beneficio","B/P neto"
"","Fondo Monetario B","LP22222222","LU","02/01/2025","Compra","20.00000000","100,000","02/05/2025","102,000","2,00%","40,00 €"
"","Acción Americana","AME.O","NASDAQ","05/02/2025","Compra","10.00000000","20,00","05/03/2025","25,00","25,00%","45,00 €"
`;

export const FUND_ORDERS_CSV = `Fecha de la orden;ISIN;Importe estimado;Nº de participaciones;Estado
28/04/2025;IE0000000001;200 EUR;;Rechazada
30/04/2025;LU0000000002;2040 EUR;20;Finalizada
01/03/2025;IE0000000001;50 EUR;5;Finalizada
01/02/2025;IE0000000001;100 EUR;10;Finalizada
31/12/2024;LU0000000002;2000 EUR;20;Finalizada
`;

export const STOCK_OPS_HTML = `<html><body><table>
<tr><td>Fechas</td><td>Operación</td><td>Mercado</td><td>Operación</td><td>ISIN</td><td>Valor</td><td>Títulos/NOMINAL</td><td>Divisa</td><td>Precio Neto</td><td>Importe neto</td></tr>
<tr><td>2025-03-05</td><td>2025-03-06</td><td>3</td><td>NASDAQ</td><td>VENTA</td><td>US0000000003</td><td>ACCION AMERICANA INC</td><td>10</td><td>USD</td><td>24.9</td><td>249.00</td></tr>
<tr><td>2025-02-20</td><td>2025-02-20</td><td>4</td><td>GENERICO</td><td>DIVIDENDO</td><td>US0000000003</td><td>ACCION AMERICANA INC</td><td>10</td><td>USD</td><td>0.1</td><td>1.00</td></tr>
<tr><td>2025-02-05</td><td>2025-02-06</td><td>2</td><td>NASDAQ</td><td>COMPRA</td><td>US0000000003</td><td>ACCION AMERICANA INC</td><td>10</td><td>USD</td><td>20.1</td><td>201.00</td></tr>
<tr><td>2025-01-10</td><td>2025-01-13</td><td>1</td><td>CONTINUO</td><td>COMPRA</td><td>ES0000000004</td><td>EMPRESA EJEMPLO SA</td><td>100</td><td>EUR</td><td>2.04</td><td>204.00</td></tr>
<tr><td>2025-07-20</td><td>2025-07-22</td><td>6</td><td>GENERICO</td><td>CONTRASPLIT-ALTA</td><td>ES0000000005</td><td>EMPRESA EJEMPLO NUEVA</td><td>10</td><td>EUR</td><td>20.4</td><td>204.00</td></tr>
<tr><td>2025-07-20</td><td>2025-07-22</td><td>5</td><td>GENERICO</td><td>CONTRASPLIT-BAJA</td><td>ES0000000004</td><td>EMPRESA EJEMPLO SA</td><td>100</td><td>EUR</td><td>2.04</td><td>204.00</td></tr>
</table></body></html>`;

export const MEXEM_CSV = `Statement,Header,Nombre del campo,Valor del campo
Statement,Data,Title,Transaction History
Transaction History,Header,Date,Account,Description,Transaction Type,Symbol,Quantity,Price,Price Currency,Gross Amount ,Commission,Net Amount
Transaction History,Data,2025-07-13,U***00000,OTRA(US0000000009) Dividendo en efectivo USD 1.05 por acción (Dividendo ordinario),Dividend,OTRA,-,-,-,10.5,-,10.5
Transaction History,Data,2025-07-13,U***00000,OTRA(US0000000009) Dividendo en efectivo USD 1.05 por acción - FEE,Other Fee,OTRA,-,-,-,-0.2,-,-0.2
Transaction History,Data,2025-06-01,U***00000,Transferencia de Fondos Electrónica,Deposit,-,-,-,-,700.0,-,700.0
Transaction History,Data,2025-02-15,U***00000,OTRA COSA HOLDING-SP ADR,Buy,OTRA.F,3.0,50.0,EUR,-150.0,-1.0,-151.0
Transaction History,Data,2025-02-15,U***00000,OTRA COSA HOLDING-SP ADR,Buy,OTRA.F,1.0,50.0,EUR,-50.0,-,-50.0
Transaction History,Data,2025-06-01,U***00000,EMPRESA EJEMPLO NUEVA SA,Buy,EJE,50,2.0,EUR,-100.0,-1.0,-101.0
`;
