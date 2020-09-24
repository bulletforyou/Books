# [Mock Server实践](https://tech.meituan.com/2015/10/19/mock-server-in-action.html)

## 背景



在美团服务端测试中，被测服务通常依赖于一系列的外部模块，被测服务与外部模块间通过REST API或是Thrift调用来进行通信。要对被测服务进行系统测试，一般做法是，部署好所有外部依赖模块，由被测服务直接调用。然而有时被调用模块尚未开发完成，或者调用返回不好构造，这将影响被测系统的测试进度。为此我们需要开发桩模块，用来模拟被调用模块的行为。最简单的方式是，对于每个外部模块依赖，都创建一套桩模块。然而这样的话，桩模块服务将非常零散，不便于管理。Mock Server为解决这些问题而生，其提供配置request及相应response方式来实现通用桩服务。本文将专门针对REST API来进行介绍Mock Server的整体结构及应用案例。

!["mock server背景"](https://awps-assets.meituan.net/mit-x/blog-images-bundle-2015/35221602.png)

"mock server背景"







## 名词解释

- Mock规则：定义REST API请求及相应模拟响应的一份描述。
- Mock环境：根据请求来源IP来区分的Mock规则分组。Mock Server可以定义多套Mock环境，各套环境间相互隔离。同一个IP只能对应一个Mock环境，不同的IP可以对应同一个Mock环境。

## 整体结构



Mock Server由web配置页面Mock Admin及通用Mock Stub组成：Mock Admin提供了web UI配置页面，可以增加/删除请求来源IP到Mock环境的映射，可以对各套环境中的Mock规则进行CRUD操作；Mock Stub提供通用桩服务，对被测系统的各类REST API请求调用，返回预先定义好的模拟响应。为了提高桩服务的通吐，使得桩服务能在被测系统压力测试中得到好的表现，我们开启了5个桩服务，通过Nginx做负载均衡。Mock Server的整体结构如下图所示。

!["mock server整体结构"](https://awps-assets.meituan.net/mit-x/blog-images-bundle-2015/acd7db25.png)

"mock server整体结构"







### 数据存储

- 将请求来源IP到Mock环境名的映射存储到mock-env.conf中，mock-env.conf的每一行定义了一条映射，如： 192.168.3.68 闫帅的测试机环境 这条映射表明来源是`192.168.3.68`的请求，使用Mock环境名为`闫帅的测试机环境`的Mock规则。
- 将配置的Mock规则存放到<对应Mock环境名>.xml中，下面部分展示了Mock规则的存储格式。

```
<configuration>
...
  <mock id="716add4f-33f7-49ac-abf3-fc617712ffea" name="test001" author="yanshuai">
    <request>
      <uri>/api/test/.*</uri>
      <method>GET|POST|PUT|DELETE</method>
      <parameters>
        <parameter name="name" value="test.*"/>
        ...
      </parameters>
      <headers>
        <header name="nb_deviceid" value="1E[0-9a-zA-Z]+"/>
        ...
      </headers>
    </request>
    <response delay="1000" real="false">
      <statusCode>200</statusCode>
      <format>application/json;charset=UTF-8</format>
      <customHeaders>
        ...
      </customHeaders>
      <body>{&quot;name&quot;:&quot;闫帅&quot;}</body>
    </response>
  </mock>
...
</configuration>
```

### Mock Stub



当请求发送到Mock Stub时，Mock Stub会根据请求的来源IP找到对应的独立环境名，然后根据独立环境名获取所有预定义的Mock规则，遍历这些Mock规则，如果找到一条规则与接受到的请求匹配，那么返回预定义的模拟响应。如果找不到规则匹配，那么返回404错误。其中，规则匹配是根据请求中的uri/method/headers/parameters/body是否与Mock规则中定义的对应字段正则匹配来定的。

!["mock stub工作原理"](https://awps-assets.meituan.net/mit-x/blog-images-bundle-2015/5d307678.png)

"mock stub工作原理"







### Mock Admin

- 打开Mock Admin配置页面，如果尚未映射来源IP地址到环境，则点击环境列表导航链接，进入环境列表页面，点击添加，输入源IP及环境名，点击确定按钮，实现源IP到所设环境的映射。

  !["mock admin环境列表"](https://awps-assets.meituan.net/mit-x/blog-images-bundle-2015/95a0dd7a.png)

  "mock admin环境列表"



\* 点击规则列表，规则列表页面将默认罗列出default环境的所有Mock规则（如“语音登录code获取”规则）。重新选择环境，可以罗列出所选环境中的Mock规则。每个Mock规则都处于详细信息展开的状态。点击“全部折叠”按钮，将把所有的规则详细信息给隐藏；点击“全部展开”按钮，将把所有的规则详细信息给展开。点击“只显示本人创建的规则”，将过滤得到mis账户用户创建的规则。点击“按创建时间排序”的开关按钮，将实现Mock规则的升序/降序显示。

!["mock admin规则列表"](https://awps-assets.meituan.net/mit-x/blog-images-bundle-2015/9ca83c82.png)

"mock admin规则列表"





\* 点击导航栏的“新建规则”选项，可以创建一个Mock规则，需要填写规则名称、请求及响应，并选中环境。对于请求，需要填写URL及勾选Method，如果要求对于符合某种规则的请求才被Mock，则填写对应的Headers/Parameters/Body Like，这些数据都是正则匹配的形式。对于响应，如果勾选了“返回真实响应”，则只需要关注延时（延时是指返回请求需要的sleep时间，单位是毫秒）。此时需要将请求的URL地址给写完整了，需要包含host(IP)及port，不能只是path。如果不勾选“返回真实响应”，则将返回模拟响应。Status Code填写返回码，比如200，404；Format选择返回数据的格式，比如json，html等；还可以返回自定义的Headers及响应的Body。点击新建按钮以后，如果创建成功，则提示成功创建，并跳转到规则列表页面。

!["mock admin新建规则"](https://awps-assets.meituan.net/mit-x/blog-images-bundle-2015/31add35b.png)

"mock admin新建规则"





\* 对于一个创建好的Mock规则，可以点击Action下拉菜单，进行操作。如果点击“克隆”，则跳转到“新建规则”页面，并将克隆的Mock规则信息给填充进去；点击“编辑”，则跳转到更新页面，更新页面填充了要编辑的Mock规则信息；点击“删除”，则弹出确认删除对话框，点击确定按钮，将删除此规则；点击取消按钮，则取消删除操作。如果此Mock规则处于详细信息展开状态，则可点击折叠来隐藏详细信息；如果处于详细信息折叠状态，则可点击展开选项，将显示详细信息。上移选项，可以将Mock规则上移一位；下移选项，可以将Mock规则下移一位。

!["mock admin规则操作"](https://awps-assets.meituan.net/mit-x/blog-images-bundle-2015/5bfc3190.png)

"mock admin规则操作"







## 使用方式

1. 修改被测服务的HTTP依赖，将依赖的IP和端口分别设置为mock.ep.sankuai.com和80，并重启被测服务；
2. 创建Mock规则；
3. 调用被测服务的API，被测服务将调用Mock服务；
4. 删除Mock规则（可选）。

### 编程使用



创建/删除Mock规则，除了可通过Mock Admin页面配置外，Mock Server还提供了SDK方式，用户可以通过编码来使用Mock Server。

\* 在Maven工程pom.xml中添加mock-client依赖



```xml
<dependency>
  <groupId>com.sankuai.meituan.ep.mockserver</groupId>
  <artifactId>mock-client</artifactId>
  <version>1.0.6</version>
</dependency>
```

- 创建/删除Mock规则

```java
// 构造Mock规则
MockRule rule = new MockRule();
rule.setMockName("test-" + System.currentTimeMillis()); // Mock name必须设置
rule.setAuthor("yanshuai"); // author必须设置，设置为代码编写者的mis账号前缀，比如lining03
MockRequest mockRequest = new MockRequest();
mockRequest.setUri("/api/test/" + System.currentTimeMillis()); // Mock请求的uri必须设置
/**
 *  Mock请求的方法必须设置
 *  如果只有GET请求，则写成GET；
 *  如果有GET请求及PUT请求，则写成GET|PUT；
 *  即用|分割请求方法，不能有空格。
 */
mockRequest.setMethod("POST|GET");
// 必要的话，设置Mock请求的匹配header
List<MockRequestHeader> mockRequestHeaders = new ArrayList<MockRequestHeader>();
mockRequestHeaders.add(new MockRequestHeader("device", "android2.3"));
mockRequest.setHeaders(mockRequestHeaders);
// 必要的话，设置Mock请求的匹配参数
List<MockRequestParameter> mockRequestParameters = new ArrayList<MockRequestParameter>();
mockRequestParameters.add(new MockRequestParameter("wd", "123.*"));
mockRequestParameters.add(new MockRequestParameter("version", "v1"));
mockRequest.setParameters(mockRequestParameters);
rule.setMockRequest(mockRequest);
MockResponse mockResponse = new MockResponse();
mockResponse.setDelay(1000L); // 设置Mock响应的延时
mockResponse.setStatusCode(200); // 设置Mock响应的状态码
/**
 * 设置Mock响应的格式
 * 如果是json返回，则为application/json;charset=UTF-8；
 * 如果是文本返回，则为text/plain:charset=UTF-8；
 * 如果是xml返回，则为text/xml;charset=UTF-8；
 * 如果是html返回，则为text/html;charset=UTF-8。
 */
mockResponse.setFormat("application/json;charset=UTF-8");
List<MockResponseHeader> mockResponseHeaders = new ArrayList<MockResponseHeader>(); // 设置Mock响应的header
mockResponseHeaders.add(new MockResponseHeader("customHeaderName", "customHeaderValue"));
mockResponse.setMockResponseHeaders(mockResponseHeaders);
mockResponse.setBody("{\"code\":200}"); // 设置Mock响应的body
rule.setMockResponse(mockResponse);
 
// 创建Mock规则
final MockClient client = new MockClient();
String id = client.addRule("default", rule); // default为环境名，如果使用别的环境，则填写别的环境名
 
// 调用被测服务的API，被测服务将调用Mock服务
// 省略调用代码...
 
// 删除Mock规则
client.removeRule("default", id); // default为环境名，如果使用别的环境，则填写别的环境名
```

## 典型案例

1. 相同Mock环境，同一接口，不同参数，可以有不同的Mock结果 按照下图，依次创建这两条规则（顺序相关），然后在default环境对应的机器上，访问

   http://mock.ep.sankuai.com/user/v1/info?token=fake

   ，返回{“code”:401,“type”:“sys_err_auth_fail”,“message”:“invalid token”}；访问

   http://mock.ep.sankuai.com/user/v1/info?token=other

   ，返回{“user”: {“id”: 29008301,“mobile”: “15001245907”,“isBindedMobile”: 1}}。

   !["案例1_1"](https://awps-assets.meituan.net/mit-x/blog-images-bundle-2015/28866c9f.png)

   "案例1_1"

!["案例1_2"](https://awps-assets.meituan.net/mit-x/blog-images-bundle-2015/d6c393e1.png)

"案例1_2"





\2. 真实请求延时Mock 按照下图创建规则，在`闫帅的测试机环境`对应的机器上，访问http://mock.ep.sankuai.com/api/v1/divisions，将延迟5s返回城市列表json串。

!["案例2"](https://awps-assets.meituan.net/mit-x/blog-images-bundle-2015/f034a82f.png)





\3. 不同Mock环境，完全相同的接口参数，可以有不同的Mock结果 按照下图创建规则，在`闫帅的测试机环境`对应的机器上，访问http://mock.ep.sankuai.com/cachier/paynotify返回值是failure；在`支付php环境`对应的机器上，访问http://mock.ep.sankuai.com/cachier/paynotify返回值是success。

!["案例3_1"](https://awps-assets.meituan.net/mit-x/blog-images-bundle-2015/a6ada7c4.png)



!["案例3_2"](https://awps-assets.meituan.net/mit-x/blog-images-bundle-2015/50854cb3.png)