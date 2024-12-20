/* 
** Copyright (c) 2024, Oracle and/or its affiliates. 
** Licensed under the Universal Permissive License v 1.0 as shown at https://oss.oracle.com/licenses/upl/ 

/**
 * @author Stephane PEILLON
 * @description 2.75:1 Low Pass FIR for Downsampling Antialisaing.
 * Works for any 2.75x kHz to x kHz downsampling.
 * ( QMF FIR filter with cut-off frequency (@ -3 dB) at about 0.913 times target fs/2 - 198 taps )
 * @example Convert 44100 Hz to 16000 Hz, or 22050 Hz to 8000 Hz.
 **/
export default [
  -5.0442670678931389e-6, 5.7387402475946118e-6, 1.6111955556881562e-5, 1.0560179594562795e-5, -1.242816862904201e-5, -3.0844307043286112e-5, -1.8160396924882423e-5, 2.303124169528074e-5,
  5.2166127028948343e-5, 2.8060268867465088e-5, -3.8960852158706798e-5, -8.1742452780124758e-5, -4.0375430619853529e-5, 6.1937527629495596e-5, 0.00012143092661620545, 5.5083199655424166e-5,
  -9.4018915834788832e-5, -0.00017326981522755043, -7.1980690559262061e-5, 0.00013762742186917889, 0.00023946132645647525, 9.0640305456980252e-5, -0.00019557611633250834, -0.00032235115028269961,
  -0.00011036322783022617, 0.00027109356679312489, 0.00042440564349633953, 0.00013013140955365376, -0.00036784896615780913, -0.00054818864384810245, -0.00014855826094166272, 0.00048997989469673812,
  0.00069634056098547199, 0.00016383778624615643, -0.00064212634080516417, -0.00087156318803636578, -0.00017369118859371453, 0.00082947634944882101, 0.0010766146787146871, 0.00017530890385814463,
  -0.0010578310750603923, -0.001314320458073489, -0.00016528446487115559, 0.0013337004262191077, 0.0015876076783199174, 0.00013953430808441101, -0.0016644454627712116, -0.0018995735273800139,
  -9.3194220249958316e-5, 0.0020584911853959329, 0.0022536018141979036, 2.0477911370491685e-5, -0.0025256449668619525, -0.0026535487754524955, 8.5524983764739568e-5, 0.0030775744811722015,
  0.0031040297261920998, -0.00023314744969763122, -0.0037285298083316772, -0.0036108562301133918, 0.000432598472497653, 0.0044964472481822506, 0.004181705019767344, -0.00069666854662353778,
  -0.0054046664894787377, -0.0048271571073186699, 0.0010418556659416306, 0.0064846675196077869, 0.0055623536874255799, -0.0014902159613265254, -0.0077805739864079248, -0.0064097301786953595,
  0.0020725170108587278, 0.0093568705461191341, 0.0074037416266333166, -0.0028338600976495301, -0.011312323822665827, -0.0085995125961405242, 0.003844300507349054, 0.013806774337071994,
  0.01008985372973804, -0.0052204603128626383, -0.01711716324115331, -0.012041967497539271, 0.0071740462453576109, 0.021768247992024713, 0.01478690833035584, -0.010136389804721707,
  -0.028887356248960279, -0.019078400739739057, 0.015146805312378952, 0.041410446665863104, 0.027068163980255515, -0.025512027260482153, -0.070112183787435889, -0.048296784335034211,
  0.060413687016046512, 0.21199607414538668, 0.32135326524472613, 0.32135326524472613, 0.21199607414538668, 0.060413687016046526, -0.048296784335034218, -0.070112183787435889, -0.025512027260482153,
  0.027068163980255515, 0.041410446665863104, 0.015146805312378952, -0.019078400739739057, -0.028887356248960279, -0.010136389804721703, 0.01478690833035584, 0.021768247992024713,
  0.0071740462453576109, -0.012041967497539271, -0.01711716324115331, -0.0052204603128626391, 0.010089853729738038, 0.013806774337071994, 0.0038443005073490553, -0.0085995125961405242,
  -0.011312323822665827, -0.0028338600976495314, 0.0074037416266333174, 0.0093568705461191341, 0.002072517010858727, -0.0064097301786953586, -0.0077805739864079248, -0.001490215961326526,
  0.0055623536874255773, 0.0064846675196077869, 0.0010418556659416256, -0.0048271571073186734, -0.0054046664894787386, -0.00069666854662353778, 0.0041817050197673448, 0.0044964472481822514,
  0.00043259847249765327, -0.0036108562301133918, -0.0037285298083316772, -0.00023314744969763149, 0.0031040297261921003, 0.0030775744811722011, 8.5524983764738972e-5, -0.002653548775452496,
  -0.0025256449668619521, 2.0477911370491641e-5, 0.002253601814197904, 0.0020584911853959329, -9.3194220249959088e-5, -0.0018995735273800139, -0.0016644454627712118, 0.00013953430808441038,
  0.0015876076783199174, 0.0013337004262191077, -0.00016528446487115559, -0.0013143204580734896, -0.0010578310750603925, 0.00017530890385814333, 0.0010766146787146878, 0.00082947634944881949,
  -0.00017369118859371463, -0.00087156318803637001, -0.0006421263408051633, 0.00016383778624615698, 0.00069634056098547155, 0.00048997989469673812, -0.00014855826094166245, -0.00054818864384810267,
  -0.00036784896615780924, 0.00013013140955365368, 0.00042440564349633964, 0.00027109356679312505, -0.00011036322783022619, -0.00032235115028269961, -0.00019557611633250842, 9.0640305456980171e-5,
  0.00023946132645647525, 0.00013762742186917883, -7.1980690559262075e-5, -0.00017326981522755049, -9.4018915834788859e-5, 5.5083199655424159e-5, 0.00012143092661620549, 6.1937527629495569e-5,
  -4.0375430619853522e-5, -8.1742452780124772e-5, -3.8960852158706805e-5, 2.8060268867465078e-5, 5.2166127028948336e-5, 2.303124169528077e-5, -1.8160396924882423e-5, -3.0844307043286126e-5,
  -1.2428168629042018e-5, 1.0560179594562806e-5, 1.6111955556881568e-5, 5.738740247594605e-6, -5.044267067893138e-6,
];
