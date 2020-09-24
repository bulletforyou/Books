# [“小众”之美——Ruby在QA自动化中的应用](https://tech.meituan.com/2018/04/27/ruby-autotest.html)

## 前言

关于测试领域的自动化，已有很多的文章做过介绍，“黑科技”也比比皆是，如通过Java字节码技术实现接口的录制，Fiddler录制内容转Python脚本，App中的插桩调试等，可见角度不同，对最佳实践的理解也不一样。这里想要阐述的是，外卖（上海）QA团队应用相对“小众”的Ruby，在资源有限的条件下实现自动化测试的一些实践与经验分享。

## 背景

加入外卖上海团队时，共2名QA同学，分别负责App与M站的功能测试，自动化测试停留在学习北京侧接口测试框架的阶段，实效上近乎为0，能力结构上在代码这部分是明显薄弱的。而摆在面前的问题是，回归测试的工作量较大，特别是M站渠道众多（4个渠道），移动端API的接口测试需区分多个版本，自动化测试的开展势在必行。在这样的条件下，如何快速且有效地搭建并推广自动化测试体系？在过去对自动化测试的多种尝试及实践的总结后，选择了Ruby。

## Why Ruby？

简单点说就是：并不聪明的大脑加上“好逸恶劳”的思想，促使我在这些年的自动化测试实践中，不断寻找更合适的解决方案。所谓技术，其本质都是站在别人的肩膀上，肩膀的高度也决定了实现目标的快慢，而Ruby正符合所需的一些特征：

1. 效率。自身应该算是“纯粹”的测试人员，在“测试开发”这重职业并不普及的年代，一直希望有种语言可以让测试的开发效率超过研发，Ruby做到了；
2. 人性化的语法，各种糖。类似1.day.ago，简单的表达不需要解释；
3. 强大的元编程能力。基于此，DHH放弃了PHP而使用Ruby开发出了Rails，DSL也因此成为Ruby开发的框架中非常普通的特性，而这对于很多主流语言都是种奢望；
4. 对于测试来说足够充足的社区资源。不涉及科学计算，不涉及服务开发，在没有这些需求的情况下，Python和Java不再是必需。

脱离了开发语言的平台，但在不关注白盒测试的情况下并无太多不妥。当Ruby用于测试开发，基本“屏蔽”了性能上的劣势，充分展现了敏捷、易用的特点，也是选择这一技术路线的主要因素。

## 接口自动化框架Coral-API

### 框架思路

接口自动化测试方案众多，个人认为它们都有自己的适用的范围和优缺点。UI类工具虽轻松实现无码Case，但在处理接口变动和全链路接口流程上多少会显得有些繁琐（尤其在支持数据驱动需求下），过多的规则、变量设置和编码也相差无几；录制类型的方案，更多还是适合回归，对于较全面的接口测试也需要一定的开发量。基于这些权衡考虑，采用一种编码尽可能少、应用面更广的接口自动化框架实现方式，把它命名为Coral-API，主要有以下特点：

1. 测试数据处理独立
   - 预先生成测试所需的最终数据，区分单接口测试数据（单接口数据驱动测试）与链路测试数据
   - 通过命令行形式的语句解决了参数的多层嵌套及动态数据生成的问题
   - Excel中维护测试数据，最终转化为YML或存入DB，折中解决了JSON形式的数据难维护问题
2. 学习成本低
   - 框架提供生成通用结构代码的功能，使测试人员更关注于业务逻辑处理
   - DSL的书写风格，即便没有Ruby的语言基础，也可以较快掌握基本的接口测试用例编写
3. 扩展性
   - 支持Java平台的扩展
   - 支持HTTP/RPC接口，可根据开发框架扩展
   - 框架基于Rspec，支持多种验证方式（Build-In Matcher），及支持自定义Matcher，目前实现了JSON去噪的Diff，各种复合的条件比较

以单个接口测试编写为例，下图描述了具体流程：

![coral-api框架](https://awps-assets.meituan.net/mit-x/blog-images-bundle-2018a/97a55ff2.png)

coral-api框架



从图中可以看到，安装了Coral-API的gem后，可通过命令行 “coral g {apiname}” ，通过模板来生成测试数据XLS及对应的数据处理文件（例如ApiOne.rb文件），修改并执行ApiOne.rb文件，则可以生成最终的测试数据（YML文件）及测试类和Case文件。如果开发框架支持（有途径可解析出参数），则可以通过脚本直接生成整个服务下所有接口的测试代码，实现自动化Case的同步开发。这种处理过程主要是一并解决了以下几个问题：

1. 复杂结构的测试数据构造
2. 动态参数的赋值
3. 测试数据的维护
4. 测试数据的加载

假设有以下这样一个接口请求格式，包含一个orderInfo的子节点，及payInfo的list，还需要解决一些变化值的问题，如各种id和time（暂且称为动态字段）。一般框架中会以JSON格式来作为测试用例的请求格式，在代码中按变量处理动态字段值。JSON作为请求数据的保存形式，存在一个很大的问题，就是后期维护，尤其是Case数量较多的时候。因此，考虑仍以Excel为数据维护的初始形式（使用上更直观），通过Sheet的嵌套来处理复杂结构，也便于后期接口参数变动后的Case维护。

```
userId: E000001
requestId: '1938670097'
orderInfo:
 orderId: '6778043386'
 count: '2'
 name: testgoods
payInfo:
- transactionId: '510455433082284'
 payTime: '2017-04-04 13:03:34'
 payType: BOC
- transactionId: '167338836018587'
 payTime: '2017-04-04 13:03:34'
 payType: Wallet
createTime: '2017-04-04 13:03:34'
```

测试数据的Excel做如下设计，Main中为第一层参数结构，预期响应另分一个Sheet，子节点和list节点的内容写在对应的Sheet中，动态值均置为空，在接口数据类中处理，orderInfo节点和payInfo节点均另写在新的Sheet中，用于单接口数据驱动的Case与链路回归用Case分开，当然这会增加一些Case维护的成本，可以选择是否区分。

![img](https://awps-assets.meituan.net/mit-x/blog-images-bundle-2018a/16d2599f.png)

示例的数据结构，通过以下语句即可实现，如果需要为后续接口测试提供前置步骤的数据，也可以同步实现，下例中为后续接口生成了5条请求数据。针对接口参数变动的情况，可以修改Excel和数据处理类文件，执行一遍即可，也提供了批量重新生成所有接口数据的脚本。

```ruby
class Demo < ApiCaseBase
	
  update self.request,:requestId=>'gen_randcode(10)',:createTime=>'get_datetime'
  add_node self.request,"orderInfo",:orderId=>'gen_randcode(10)'
  add_list self.request,"payInfo",:transactionId=>'gen_randcode(15)',:payTime=>'get_datetime'
  
  sheetData={'ForApiOther'=>5}
  
  generate_data self,sheetData do
    update_force @data,:orderId=>'gen_randcode(10)',:createTime=>'get_datetime'
    add_node_force @data,"orderInfo",:orderId=>'gen_randcode(10)'
    add_list_force @data,"payInfo",:transactionId=>'gen_randcode(15)',:payTime=>'get_datetime'
  end
end
```

Excel作为Case的维护形式，缺点是Case较多情况下频繁读取比较影响时间。在这种情况下，考虑到把数据序列化到YML中，启动执行时接口测试类自动与测试数据进行绑定。在Case中可以直接使用形如 DemoTest.request[1]的请求数据，提高了速度，结构上也清晰了不少。

接口测试类文件（HTTP接口调用为例）生成的模板如下，修改对应的接口信息即可，支持DB验证（代码块p这部分是目前唯一需要写Ruby代码的地方，当然这是非必需项）。

```ruby
require 'apicasebase'
 
class PreviewTest
 
  include ApiTestBase
 
  set_cookie
 
  set_domain "Domain_takeaway"
 
  set_port 80
 
  set_path "/waimai/ajax/wxwallet/Preview"
 
  set_method "get"
 
  set_sql "select * from table"
 
  p = proc do |dbres|
    ## do something
    ## return a hash
  end
 
  set_p p

end
```

TestCase文件如下，原则上无需修改，只需要在测试数据的Excel中编写匹配规则及预期输出，基本上实现了单个接口无编码的数据驱动测试。

```ruby
require 'Preview_validate'
 
RSpec.shared_examples "Preview Example" do |key,requestData,expData|
 
    it 'CaseNo'+ key.to_s + ': '+expData['memo'] do
 
      response = PreviewTest.response_of(key)
      
      expect(response).to eval("#{expData['matcher']} '#{expData['expection']}'")
 
    end
end
 
RSpec.describe "Preview接口测试",:project=>'api_m_auto',:author=>'Neil' do
  PreviewTest.request.each{|key,parameter|include_examples "Preview Example",key,PreviewTest.request[key],PreviewTest.expect[key]}
end
```

接口流程Case编写就是各独立接口的业务逻辑串联，重点是Case的组织，把一些公用的Steps独立出shared_examples，在主流程的Case中include这些shared_examples即可，关联的上下游参数 通过全局变量来传递。

```ruby
RSpec.describe "业务流程测试" ,:project=>'api_m_auto',:author =>'Neil' do
  let(:wm_b_client) { WmBClient.new('自配') }
  
  before(:context) do
    init_step
  end
  
  context "在线支付->商家接单->确认收货->评价" do
    include_examples "OrderAndPay Example",1
    include_examples "AcceptOrder Example"
    include_examples "CommentStep Example"
  end  
end
```

通过上面的介绍，可以看到，Case的编写大部分可以通过代码生成实现（熟悉以后部分接口也可以根据需要进行操作步骤的取舍，如直接编写YML）。实践下来的情况是，从各方面一无所有，17个人日左右的时间，完成了M站API层接口自动化（业务流程9个，单个接口10个）及点评外卖移动端API的接口自动化（业务流程9个，单个接口20个），实现了外卖业务全链路接口回归，平均每个业务流Case步骤9个左右。期间也培养了一名之前未接触过Ruby的同学，在完成了第一版开发后，两名初级阶段的同学逐步承担起了框架的改进工作，实现了更多有效的验证Matcher，并支持了移动端API多版本的测试。之后的回归测试不仅时间上缩减了50%以上，也通过接口自动化3次发现了问题，其中一次API不同版本导致的Bug充分体现了自动化测试的效率。通过ci_reporter，可以方便地将Rspec的报告格式转为JUnit的XML格式，在Jenkins中做对应的展示。

![测试报告jenkins展示](https://awps-assets.meituan.net/mit-x/blog-images-bundle-2018a/309c62eb.png)

测试报告jenkins展示



### 解决接口多版本测试的例子

移动端API自动化中存在的问题就是，一个接口会存在多个版本并存的情况，有header中内容不同的，或formdata内容不同的情况，在接口回归中必须都要照顾到，在Coral-API中我们采用以下方式进行处理。

在config.yml中定义各版本的header。

```ruby
Domain_takeaway_header:
	v926: '{"connection":"upgrade","x-forwarded-for":"172.24.121.32, 203.76.219.234","mkunionid":"-113876624192351423","pragma-apptype":"com.dianping.ba.dpscope","mktunneltype":"tcp","pragma-dpid":"-113876624192351423","pragma-token":"e7c10bf505535bfddeba94f5c050550adbd9855686816f58f0b5ca08eed6acc6","user-agent":"MApi 1.1 (dpscope 9.4.0 appstore; iPhone 10.0.1 iPhone9,1; a0d0)","pragma-device":"598f7d44120d0bf9eb7cf1d9774d3ac43faed266","pragma-os":"MApi 1.1 (dpscope 9.2.6 appstore; iPhone 10.0.1 iPhone9,1; a0d0)","mkscheme":"https","x-forwarded-for-port":"60779","X-CAT-TRACE-MODE":"true","network-type":"wifi","x-real-ip":"203.76.219.234","pragma-newtoken":"e7c10bf505535bfddeba94f5c050550adbd9855686816f58f0b5ca08eed6acc6","pragma-appid":"351091731","mkoriginhost":"mobile.dianping.com","pragma-unionid":"91d9c0e21aca4170bf97ab897e5151ae0000000000040786871"}' 
    v930: '{"connection":"upgrade","x-forwarded-for":"172.24.121.32, 203.76.219.234","mkunionid":"-113876624192351423","pragma-apptype":"com.dianping.ba.dpscope","mktunneltype":"tcp","pragma-dpid":"-113876624192351423","pragma-token":"e7c10bf505535bfddeba94f5c050550adbd9855686816f58f0b5ca08eed6acc6","user-agent":"MApi 1.1 (dpscope 9.4.0 appstore; iPhone 10.0.1 iPhone9,1; a0d0)","pragma-device":"598f7d44120d0bf9eb7cf1d9774d3ac43faed266","pragma-os":"MApi 1.1 (dpscope 9.3.0 appstore; iPhone 10.0.1 iPhone9,1; a0d0)","mkscheme":"https","x-forwarded-for-port":"60779","X-CAT-TRACE-MODE":"true","network-type":"wifi","x-real-ip":"203.76.219.234","pragma-newtoken":"e7c10bf505535bfddeba94f5c050550adbd9855686816f58f0b5ca08eed6acc6","pragma-appid":"351091731","mkoriginhost":"mobile.dianping.com","pragma-unionid":"91d9c0e21aca4170bf97ab897e5151ae0000000000040786871"}'
    ......
```

在接口测试类被加载时会进行全局变量赋值，同时替换header里对应节点的token，测试数据YML文件中则做这样的描述，每条数据的header则较方便地被替换。

```ruby
---
Main:
  1: &DEFAULT
    headers: '<%= $v926 %>'
    host: mobile.51ping.com
    port: '80'
    path: "/deliveryaddresslist.ta"
    search: "?geotype=2&actuallat=31.217329&actuallng=121.415603&initiallat=31.22167778439444&initiallng=121.42671951083571"
    method: GET
    query: '{"geotype":"2","actuallat":"31.217329","actuallng":"121.415603","initiallat":"31.22167778439444","initiallng":"121.42671951083571"}'
    formData: "{}"
    scheme: 'http:'
  2:
    <<: *DEFAULT
    headers: '<%= $v930 %>'
  3:
    <<: *DEFAULT
    headers: '<%= $v940 %>'
  4:
    <<: *DEFAULT
    headers: '<%= $v950 %>'
  5:
    <<: *DEFAULT
    headers: '<%= $v990 %>'
```

### 解决RPC接口测试

HTTP接口的测试框架选择面还是比较多的，RPC调用的框架如何测试呢？答案就是JRuby + Java的反射调用，在Pigeon接口中我们已经试点了这种方式，证明是可行的，针对不同的RPC框架实现不同的Adapter（Jar文件），Coral-API传参（JSON格式）给Adapter，Adapter通过解析参数进行反射调用，这样对于框架来说无需改动，只需对部分文件模板稍作调整，也无需在Ruby中混写Java代码，实现了最少的代码量—2行。

![rpc调用](https://awps-assets.meituan.net/mit-x/blog-images-bundle-2018a/70d10d3e.png)

rpc调用



## UI自动化框架Coral-APP

### 框架思想

App的UI自动化，Ruby的简便性更明显，尤其Appium提供了对Ruby良好的支持，各种UI框架的优劣就不在此赘述了。综合比较了Appium与Calabash后，选择了前者，测试框架选用了更适合业务流描述的Cucumber，沿用了以前在Web自动化中使用的对象库概念，将页面元素存储在CSV中，包括了Android与iOS的页面对象描述，满足不同系统平台的测试需要。在针对微信M站的UI自动化方案中，还需解决微信WebView的切换，及多窗口的切换问题，appium_lib都提供了较好的支持，下面介绍下结合了Appium及Cucumber的自动化框架Coral-APP。

框架结构如下图：

![coral-app](https://awps-assets.meituan.net/mit-x/blog-images-bundle-2018a/2bfa4216.png)

coral-app



step_definitions目录下为步骤实现，public_step.rb定义了一些公共步骤，比如微信测试需要用到的上下文切换，Webview里的页面切换功能，也可以通过support目录下的global_method.rb里新增的Kernel中的方法来实现。

support/native目录下为app测试的配置文件，support/web目录下为h5测试的配置文件。

support/env.rb 为启动文件，主要步骤如下：

```ruby
$caps = Appium.load_appium_txt file: File.expand_path('../app/appium.txt', __FILE__), verbose: true
 
$caps[:caps].store("chromeOptions",{"androidProcess":"com.tencent.mm:tools"})
 
$driver = Appium::Driver.new($caps,true)
 
Elements.generate_all_objects
 
Before{$driver.start_driver}

After{$driver.quit_driver}
```

support/elements下为对象库CSV文件，内容如下图：

![对象库文件](https://awps-assets.meituan.net/mit-x/blog-images-bundle-2018a/06392013.png)

对象库文件



support/elements.rb为对象库实现，将CSV中的描述转换为Elements模块中对象的功能，这样在Page中就可以直接使用类似“Elements.微信我” 这样的对象描述了。

```ruby
......
  
def self.define_ui_object(element)
  case $caps[:caps][:platformName].downcase
    when "android"
      idempotently_define_singleton_method(element["OBJNAME"]){$driver.find_element(:"#{element["ATTRIBUTE"]}","#{element["ANDROID_IDENTITY"]}")}
    else
      idempotently_define_singleton_method(element["OBJNAME"]){$driver.find_element(:"#{element["ATTRIBUTE"]}","#{element["IOS_IDENTITY"]}")}
  end
end
 
......
```

support/pages为Page层，实现了每个页面下的操作，目前把它实现为Kernel中的方法，采用中文命名，便于阅读使用。

```ruby
module Kernel
  def 点击我
    Elements.微信我.click
  end
 
  def 点击收藏按钮
    Elements.微信收藏.click
  end
 
  def 点击收藏项
    Elements.微信收藏链接.click
  end
 
  def 点击收藏中的美团外卖链接
    Elements.微信收藏链接URL.click
  end
end
```

step里的步骤我们可以这样写，封装好足够的公共步骤或方法，Case的编写就是这么简单。

```ruby
When /^进入美团外卖M站首页$/ do
 
  点击我
 
  点击收藏按钮
 
  点击收藏项
 
  点击收藏中的美团外卖链接
 
  等待 5
 
  step "切换到微信Webview"
 
  等待 15
 
  step "切换到美团外卖window"
 
end
```

最终Feature内容如下：

```ruby
Feature: 回归下单主流程
  打开微信->进入首页->定位->进入自动化商户->下单->支付->订单详情
  Scenario:
    When 进入美团外卖M站首页
```

相对于其他的UI测试框架，使用接近自然语言的描述，提高了Case可读性，编写上也没有其他框架那么复杂。当然UI自动化中还是有一些小难点的，尤其是Hybrid应用，Appium目前还存在些对使用影响不大的Bug，在框架试用完成的情况下，将在微信入口体验优化项目结束后的进一步使用中去总结与完善。

## 质量工作的自动化

都知道在美团点评，QA还担负着质量控制的工作，当功能+自动化+性能+其他测试工作于一身，而且是1:8的测试开发比下，如何去关注质量的改进？答案只有：工具化、自动化。开发这样一个小系统，技术方案选择上考虑主要是效率和学习成本，符合敏捷开发的特点，基于这些因素，应用了被称为“Web开发的最佳实践”的Rails框架。

Rails的设计有些颠覆传统的编程理念，CRUD的实现上不用说了，一行命令即可，数据库层的操作，通过migration搞定，在Mail，Job等功能的实现上也非常方便，框架都有对应的模块，并且提供了大量的组件，Session、Cookie、安全密码、邮件地址校验都有对应的gem，感觉不像是在写代码，更像是在配置项目，不知不觉，一个系统雏形就完成了，整理了下项目中使用到的gem，主要有以下这些。

前端相关：

1. bootstrap-sass Bootstrap框架
2. jquery-rails jQuery框架
3. simple_form 优化的form组件
4. chartkick 堪称一行代码即可的图表组件
5. hightchart 图表组件

后端相关:

1. validates_email_format_of 邮件地址校验
2. has_secure_password 安全密码组件
3. mysql2 MySQL连接组件
4. cancancan 权限管理组件
5. sidekiq 队列中间件
6. sidekiq-cron 定时Job组件
7. rest-client Http And Rest Client For Ruby
8. will_paginate 分页组件

从搭建开发环境、写Demo，自己做产品、开发、测试、搭建生产环境、部署，边参阅文档边实现，总共18个人日左右，实现了平台基础功能、线上故障问题的管理及通知、测试报告的管理及通知、Sonar数据的抽取（Job及邮件）、Bug数据的抽取（Job）、自动化测试项目的接入、质量数据的Dashboard各类数据图表展示等功能，以下为系统功能的两个示例:

**后台管理界面**

![shwmqp manager](https://awps-assets.meituan.net/mit-x/blog-images-bundle-2018a/2772396b.png)

shwmqp manager



**线下缺陷周趋势**

![shwmqp manager](https://awps-assets.meituan.net/mit-x/blog-images-bundle-2018a/8a95fb3a.png)

shwmqp manager



应用Rails，团队较快进入了可以通过数据进行质量分析的初级阶段，当然还有很长的路要走，在从0到1的这个过程中，还是较多地体会到了敏捷开发的特性，也充分感受到了DRY理念。

## 总结

以上为半年左右时间内，外卖上海QA团队在自动化工作上的一些实践，总的来说，达到一定预期效果，整理这篇文章分享一些心得。所谓的主流与小众并非绝对，主要从几个方面衡量：

1. 应用领域。Ruby因为性能问题，始终不太主流，但并不意味着它一无是处，用在测试领域，开发效率、DSL的友好性、语言的粘合性、使用者的学习低成本，都能发挥很大的优势。
2. 使用群体。不同的使用群体对于技能掌握的要求也是不同的，能达到同样效果甚至超过预期则就可以选择哪怕“小众”的方案。
3. 环境背景。其实有很多初创公司选择Ruby作为初期的技术栈有一定的道理，而这与我们当初的情景有相似之处，实际效果也体现了语言的特性。

当然应用“小众”技术，必然要面对不少挑战：如何迅速培养能掌握相关技术的同学，与其他语言平台的衔接问题，面对团队的质疑等。尤其Ruby属于易学难精的那种，从脚本语言应用层次上升到动态语言设计层次还是需要一定的学习曲线的，也就是说对于使用者来说是简单的，对于设计者的能力要求较高，就像流传的Ruby程序员的进阶过程就是魔法师的养成史。

正因为有特色的技术，才值得去研究和学习，就像它的设计者所说，目的就是为了让开发人员觉得编程是件快乐的事情。做了这么些年的测试，还能够不停止写代码的脚步，也是因为几年前开始接触Ruby。不论将来是否成为主流，它仍然是测试领域工具语言的不错选择，不管以后会出现什么样的技术，选型的标准也不会改变。技术的世界没有主流与小众，只有理解正确与否，应用得当与否。